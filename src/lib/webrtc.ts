import { generateKeyPair, exportPublicKey, importPublicKey, deriveSharedKey, encryptPayload, decryptPayload, encryptChunk, decryptChunk, deriveKeyFromPassword } from './crypto';
import { addMessage, addFile, type SharedFile } from './db';
import { joinRoom, type Room } from 'trystero';
// We removed CompressionStream to fix critical crashes on iOS/iPadOS Safari 15/16.
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type ConnectionCallback = (status: ConnectionStatus, error?: string) => void;
export type MessageCallback = () => void;
export type ProgressCallback = (fileId: string, name: string, bytes: number, total: number, type: 'upload' | 'download') => void;
export type TransferErrorCallback = (fileId: string, error: string) => void;

export class WebRTCManager {
  public pc: RTCPeerConnection;
  public dataChannel?: RTCDataChannel;
  public onConnectionStatusChange: ConnectionCallback;
  private onNewData: MessageCallback;
  public onProgress?: ProgressCallback;
  public onTransferError?: TransferErrorCallback;
  private cancelledTransfers: Set<string> = new Set();
  private ecdhKeyPair: CryptoKeyPair | null = null;
  private sharedKey: CryptoKey | null = null;
  private ackListeners: { [fileId: string]: (ackIndex: number) => void } = {};
  public onIceCandidatesBatched?: (candidates: any[]) => void;
  private candidateBuffer: any[] = [];
  private candidateTimer: any = null;
  private idleTimeoutTimer: any = null;
  private IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  public disconnectReason?: string;
  public roomId?: string;

  // File receiving state
  private activeReceives: { 
    [fileId: string]: { 
      meta: { name: string; type: string; size: number; ivBase: Uint8Array },
      fileHandle?: FileSystemFileHandle,
      opfsEnabled?: boolean,
      opfsReady: Promise<boolean> | null,
      chunksQueue: { index: number, data: Uint8Array }[],
      ramFallback: Uint8Array[],
      nextIndex: number,
      receivedBytes: number,
      isWriting: boolean,
      isDone: boolean,
      pendingDecrypts: number,
      lastProgressTime: number
    } 
  } = {};

  private opfsWorker?: Worker;

  constructor(onStatusChange: ConnectionCallback, onNewData: MessageCallback) {
    this.onConnectionStatusChange = onStatusChange;
    this.onNewData = onNewData;
    
    try {
      this.opfsWorker = new Worker(new URL('./opfs.worker.ts', import.meta.url), { type: 'module' });
      this.opfsWorker.addEventListener('message', (e: MessageEvent) => {
        if (e.data.type === 'write-error') {
          this.handleWriteError(e.data.fileId, e.data.error);
        }
      });
    } catch (e) {
      console.warn('[WebRTC] Failed to initialize OPFS Worker. Will fallback to RAM.', e);
    }
    
    // Using public STUN servers for NAT traversal
    this.pc = new RTCPeerConnection({
      iceCandidatePoolSize: 2,
      bundlePolicy: 'max-bundle',
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.relay.metered.ca:80' },
        { 
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turns:openrelay.metered.ca:443'
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    });

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.candidateBuffer.push(e.candidate.toJSON());
        if (!this.candidateTimer) {
          this.candidateTimer = setTimeout(() => {
            if (this.onIceCandidatesBatched && this.candidateBuffer.length > 0) {
              this.onIceCandidatesBatched([...this.candidateBuffer]);
              this.candidateBuffer = [];
            }
            this.candidateTimer = null;
          }, 500); // 500ms batch window to allow mobile devices to gather relay candidates
        }
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log('[WebRTC] connectionState:', this.pc.connectionState);
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] iceConnectionState:', this.pc.iceConnectionState);
      if (this.pc.iceConnectionState === 'failed') {
        this.onConnectionStatusChange('error', 'Connection failed');
      }
    };

    this.pc.onsignalingstatechange = () => {
    };

    this.pc.onicegatheringstatechange = () => {
      console.log('[WebRTC] iceGatheringState:', this.pc.iceGatheringState);
    };

    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };
  }

  private handleWriteError(fileId: string, error: string) {
    const state = this.activeReceives[fileId];
    if (state) {
      console.error(`[WebRTC] Write error for ${fileId}: ${error}`);
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify({ type: 'file-error', id: fileId, error: 'Receiver out of storage space' }));
      }
      delete this.activeReceives[fileId];
      if (this.onTransferError) this.onTransferError(fileId, 'Out of storage space');
    }
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;
    this.dataChannel.binaryType = 'arraybuffer';
    this.dataChannel.bufferedAmountLowThreshold = 65536; // 64KB threshold for event firing
    
    const handleOpen = () => {
      this.onConnectionStatusChange('connected');
      this.resetIdleTimer();
    };

    if (this.dataChannel.readyState === 'open') {
      handleOpen();
    } else {
      this.dataChannel.onopen = handleOpen;
    }

    this.dataChannel.onclose = () => {
      this.onConnectionStatusChange('error', this.disconnectReason || 'Connection closed');
    };

    this.dataChannel.onmessage = async (event) => {
      this.resetIdleTimer();
      if (!this.sharedKey) return;
      
      try {
        if (typeof event.data === 'string') {
          // It's a JSON string (chat message or file metadata)
          const data = JSON.parse(event.data);
          
          if (data.type === 'chat') {
            const decryptedText = await decryptPayload(this.sharedKey, data.ciphertext, data.iv);
            await addMessage({ sender: 'peer', text: decryptedText, timestamp: Date.now() });
            this.onNewData();
          } else if (data.type === 'file-meta') {
            const ivStr = atob(data.ivBase);
            const ivBase = new Uint8Array(ivStr.length);
            for(let i=0; i<ivStr.length; i++) ivBase[i] = ivStr.charCodeAt(i);

            const receiveId = data.id;

            // OPFS init via Web Worker to prevent Main Thread crashes in Firefox/Safari
            let resolveOpfs: (val: boolean) => void = () => {};
            const opfsReady = new Promise<boolean>((resolve) => { resolveOpfs = resolve; });

            if (this.opfsWorker) {
              const workerListener = (e: MessageEvent) => {
                if (e.data.fileId === receiveId) {
                  if (e.data.type === 'init-success') {
                    this.opfsWorker?.removeEventListener('message', workerListener);
                    resolveOpfs(true);
                  } else if (e.data.type === 'init-error') {
                    console.warn(`[WebRTC] OPFS Worker init failed, falling back to RAM: ${e.data.error}`);
                    this.opfsWorker?.removeEventListener('message', workerListener);
                    resolveOpfs(false);
                  }
                }
              };
              this.opfsWorker.addEventListener('message', workerListener);
              this.opfsWorker.postMessage({ type: 'init', fileId: receiveId, name: data.name });
            } else {
              resolveOpfs(false);
            }

            this.activeReceives[receiveId] = {
              meta: {
                name: data.name,
                type: data.fileType,
                size: data.size,
                ivBase
              },
              opfsReady,
              chunksQueue: [],
              ramFallback: [],
              nextIndex: 0,
              receivedBytes: 0,
              isWriting: false,
              isDone: false,
              pendingDecrypts: 0,
              lastProgressTime: Date.now()
            };

          } else if (data.type === 'file-ack') {
            if (this.ackListeners[data.id]) {
              this.ackListeners[data.id](data.index);
            }
          } else if (data.type === 'file-done') {
            const receiveState = this.activeReceives[data.id];
            if (receiveState) {
              receiveState.isDone = true;
              this.processWriteQueue(data.id);
            }
          } else if (data.type === 'file-error') {
            this.cancelledTransfers.add(data.id);
            if (this.onTransferError) this.onTransferError(data.id, data.error);
          }
        } else {
          // Binary chunk
          const buffer = event.data as ArrayBuffer;
          const uuidBytes = new Uint8Array(buffer.slice(0, 36));
          const fileId = new TextDecoder().decode(uuidBytes);
          
          const receiveState = this.activeReceives[fileId];
          if (receiveState) {
            const view = new DataView(buffer);
            const chunkIndex = view.getUint32(36);
            const encryptedChunk = new Uint8Array(buffer.slice(40));

            // Decrypt Chunk
            const chunkIv = new Uint8Array(12);
            chunkIv.set(receiveState.meta.ivBase);
            const ivView = new DataView(chunkIv.buffer);
            ivView.setUint32(8, ivView.getUint32(8) ^ chunkIndex);

            receiveState.pendingDecrypts++;
            try {
              const decryptedBuffer = await decryptChunk(this.sharedKey, encryptedChunk, chunkIv);
              const decryptedChunk = new Uint8Array(decryptedBuffer);
              receiveState.chunksQueue.push({ index: chunkIndex, data: decryptedChunk });
            } catch (e) {
              console.error("[WebRTC] Failed to decrypt chunk", e);
            } finally {
              receiveState.pendingDecrypts--;
              this.processWriteQueue(fileId);
            }
          }
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    };
  }

  public flushIceCandidates() {
    if (this.candidateTimer) {
      clearTimeout(this.candidateTimer);
      this.candidateTimer = null;
    }
    if (this.onIceCandidatesBatched && this.candidateBuffer.length > 0) {
      this.onIceCandidatesBatched([...this.candidateBuffer]);
      this.candidateBuffer = [];
    }
  }

  private async processWriteQueue(fileId: string) {
    const state = this.activeReceives[fileId];
    if (!state || state.isWriting) return;
    state.isWriting = true;

    // Wait for OPFS init to finish before the first write.
    if (state.opfsReady) {
      state.opfsEnabled = await state.opfsReady;
      state.opfsReady = null;
    }

    try {
      state.chunksQueue.sort((a,b) => a.index - b.index);

      while (state.chunksQueue.length > 0 && state.chunksQueue[0].index === state.nextIndex) {
        const chunk = state.chunksQueue.shift()!;
        
        if (state.opfsEnabled && this.opfsWorker) {
          // Offload to worker thread. Transferable object (chunk.data.buffer) could be used 
          // for zero-copy, but it would detach the buffer if used elsewhere. Since 
          // chunk.data is not used again, we could transfer it, but structured clone is fast enough for 16KB.
          this.opfsWorker.postMessage({ type: 'write', fileId, chunk: chunk.data });
        } else {
          try {
            state.ramFallback.push(chunk.data);
          } catch (err: any) {
            this.handleWriteError(fileId, "Out of memory");
            return;
          }
        }
        
        state.nextIndex++;
        state.receivedBytes += chunk.data.byteLength;
        
        // Send ACK back to sender to release backpressure every 50 chunks (~800KB)
        if (chunk.index % 50 === 0) {
          if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify({ type: 'file-ack', id: fileId, index: chunk.index }));
          }
        }

        const now = Date.now();
        if (this.onProgress && now - state.lastProgressTime > 100) {
          this.onProgress(fileId, state.meta.name, state.receivedBytes, state.meta.size, 'download');
          state.lastProgressTime = now;
        }
      }
    } catch (e) {
      console.error("[WebRTC] Error writing chunk to disk", e);
    } finally {
      state.isWriting = false;
      
      if (state.isDone && state.chunksQueue.length === 0 && state.pendingDecrypts === 0) {
        this.finishFile(fileId);
      }
    }
  }

  private async finishFile(fileId: string) {
    const state = this.activeReceives[fileId];
    if (!state) return;

    try {
      let finalBlob: Blob | undefined;
      let handle: FileSystemFileHandle | undefined;
      
      if (state.opfsEnabled && this.opfsWorker) {
        // Wait for worker to close the file
        await new Promise<void>((resolve) => {
          const closeListener = (e: MessageEvent) => {
            if (e.data.fileId === fileId && (e.data.type === 'close-success' || e.data.type === 'close-error')) {
              this.opfsWorker?.removeEventListener('message', closeListener);
              resolve();
            }
          };
          this.opfsWorker?.addEventListener('message', closeListener);
          this.opfsWorker?.postMessage({ type: 'close', fileId });
        });

        // Worker closed it. Now Main Thread can get the read handle to save in IndexedDB
        try {
          const root = await navigator.storage.getDirectory();
          handle = await root.getFileHandle(`swarmgrid-${fileId}`);
        } catch (opfsErr) {
          console.error(`[WebRTC] Could not get file handle after worker close:`, opfsErr);
        }
      } else {
        finalBlob = new Blob(state.ramFallback as any[], { type: state.meta.type });
      }
      
      const sharedFile: SharedFile = {
        id: fileId,
        name: state.meta.name,
        type: state.meta.type,
        size: state.meta.size,
        blob: finalBlob,
        fileHandle: handle,
        sender: 'peer',
        timestamp: Date.now()
      };
      
      await addFile(sharedFile);
      this.onNewData();
      
      if (this.onProgress) {
        this.onProgress(fileId, state.meta.name, state.meta.size, state.meta.size, 'download');
      }
    } catch (e) {
      console.error("[WebRTC] Error completing file assembly", e);
    } finally {
      delete this.activeReceives[fileId];
    }
  }

  public async generateOffer(): Promise<any> {
    this.ecdhKeyPair = await generateKeyPair();
    const publicKeyBase64 = await exportPublicKey(this.ecdhKeyPair.publicKey);

    this.dataChannel = this.pc.createDataChannel('swarm-grid');
    this.setupDataChannel();

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    const payload = {
      sdp: this.pc.localDescription,
      publicKey: publicKeyBase64
    };

    return payload;
  }

  public async handleOffer(payload: any): Promise<any> {
    try {
      this.ecdhKeyPair = await generateKeyPair();
      const myPublicKeyBase64 = await exportPublicKey(this.ecdhKeyPair.publicKey);
      
      const peerPublicKey = await importPublicKey(payload.publicKey);
      this.sharedKey = await deriveSharedKey(this.ecdhKeyPair.privateKey, peerPublicKey);

      await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      const answerPayload = {
        sdp: this.pc.localDescription,
        publicKey: myPublicKeyBase64
      };

      return answerPayload;
    } catch (e) {
      console.error(e);
      this.onConnectionStatusChange('error', 'Invalid Offer payload.');
      throw e;
    }
  }

  public async handleAnswer(payload: any) {
    try {
      const peerPublicKey = await importPublicKey(payload.publicKey);
      
      if (!this.ecdhKeyPair) throw new Error("Local key pair not found.");
      
      if (this.pc.signalingState !== 'have-local-offer') {
        throw new Error(`Expected signaling state "have-local-offer", but got "${this.pc.signalingState}". This usually happens if the page was hot-reloaded or the connection was reset. Please refresh the page and try again.`);
      }

      this.sharedKey = await deriveSharedKey(this.ecdhKeyPair.privateKey, peerPublicKey);
      
      await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    } catch (e) {
      console.error('[WebRTC] Error in handleAnswer:', e);
      this.onConnectionStatusChange('error', 'Invalid Answer string.');
      throw e;
    }
  }

  public async addIceCandidates(candidates: any[]) {
    for (const candidate of candidates) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] Error adding ICE candidate:', e);
      }
    }
  }

  public async sendChat(text: string) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open' || !this.sharedKey) {
      throw new Error("Connection not open.");
    }

    const { ciphertext, iv } = await encryptPayload(this.sharedKey, text);
    const msg = JSON.stringify({ type: 'chat', ciphertext, iv });
    
    this.dataChannel.send(msg);
    this.resetIdleTimer();
    await addMessage({ sender: 'me', text, timestamp: Date.now() });
    this.onNewData();
  }

  public async sendFile(file: File) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open' || !this.sharedKey) {
      throw new Error("Connection not open.");
    }

    const fileId = crypto.randomUUID();
    const ivBase = window.crypto.getRandomValues(new Uint8Array(12));

    // 1. Send Metadata
    this.dataChannel.send(JSON.stringify({
      type: 'file-meta',
      id: fileId,
      name: file.name,
      fileType: file.type,
      size: file.size,
      ivBase: btoa(String.fromCharCode(...ivBase))
    }));

    // 2. Stream and encrypt in 16KB chunks to prevent max message size errors
    const CHUNK_SIZE = 16 * 1024;
    const reader = file.stream().getReader();
    const idBytes = new TextEncoder().encode(fileId); // 36 bytes
    let chunkIndex = 0;
    
    let lastAckedIndex = -1;
    let resumePromise: (() => void) | null = null;

    this.ackListeners[fileId] = (ackIndex: number) => {
      lastAckedIndex = Math.max(lastAckedIndex, ackIndex);
      if (resumePromise && chunkIndex - lastAckedIndex <= 300) {
        resumePromise();
        resumePromise = null;
      }
    };
    
    // Helper to send data with network backpressure
    const sendWithBackpressure = async (data: any) => {
      if (this.dataChannel!.bufferedAmount > 1024 * 1024) { // 1MB threshold
        await new Promise<void>(resolve => {
          let resolved = false;
          const doResolve = () => {
            if (resolved) return;
            resolved = true;
            this.dataChannel!.removeEventListener('bufferedamountlow', listener);
            clearInterval(fallbackInterval);
            resolve();
          };
          const listener = () => doResolve();
          this.dataChannel!.addEventListener('bufferedamountlow', listener);
          
          // Failsafe: Chrome sometimes drops the bufferedamountlow event. Poll manually.
          const fallbackInterval = setInterval(() => {
            if (this.dataChannel!.bufferedAmount <= 512 * 1024) {
              doResolve();
            }
          }, 50);
        });
      }
      this.dataChannel!.send(data);
      
      // Reset idle timer occasionally during file transfer to prevent timeout on large files
      if (Math.random() < 0.01) this.resetIdleTimer();
    };

    while (true) {
      if (this.cancelledTransfers.has(fileId)) {
        this.cancelledTransfers.delete(fileId);
        delete this.ackListeners[fileId];
        return; // Abort transfer immediately
      }

      // Cross-machine backpressure: Wait if receiver disk is falling behind (300 chunks = ~4.8MB)
      if (chunkIndex - lastAckedIndex > 300) {
        let failsafeTimer: any;
        await new Promise<void>(r => { 
          resumePromise = r; 
          // Failsafe: If ACK is lost in transit, resume slowly after 3 seconds to avoid infinite freeze
          failsafeTimer = setTimeout(() => {
            console.warn("[WebRTC] Missing ACK timeout, forcing resume to prevent freeze");
            r();
          }, 3000);
        });
        clearTimeout(failsafeTimer);
      }

      const { done, value } = await reader.read();
      if (done) break;

      // Slice the read stream into exact 64KB chunks if it's larger
      for (let offset = 0; offset < value.byteLength; offset += CHUNK_SIZE) {
        const chunk = value.subarray(offset, offset + CHUNK_SIZE);
        
        // Construct IV for this chunk
        const chunkIv = new Uint8Array(12);
        chunkIv.set(ivBase);
        const view = new DataView(chunkIv.buffer);
        view.setUint32(8, view.getUint32(8) ^ chunkIndex);

        const encryptedBuffer = await encryptChunk(this.sharedKey, chunk, chunkIv);
        const encryptedChunk = new Uint8Array(encryptedBuffer);

        // Payload: [36 bytes UUID] [4 bytes chunkIndex] [encrypted data]
        const payload = new Uint8Array(36 + 4 + encryptedChunk.length);
        payload.set(idBytes, 0);
        const payloadView = new DataView(payload.buffer);
        payloadView.setUint32(36, chunkIndex);
        payload.set(encryptedChunk, 40);

        await sendWithBackpressure(payload);
        chunkIndex++;
        
        if (this.onProgress) {
          const sentBytes = Math.min(chunkIndex * CHUNK_SIZE, file.size);
          this.onProgress(fileId, file.name, sentBytes, file.size, 'upload');
        }
      }
    }

    // 3. Send Completion
    await sendWithBackpressure(JSON.stringify({
      type: 'file-done',
      id: fileId
    }));
    
    delete this.ackListeners[fileId];

    // Save to local DB unencrypted
    // Omit the blob for the sender to prevent massive IndexedDB duplication and quota errors.
    // The sender does not need to download their own file anyway.
    try {
      await addFile({
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        blob: undefined,
        sender: 'me',
        timestamp: Date.now()
      });
      this.onNewData();
    } catch (dbErr) {
      console.error("[WebRTC] Failed to save sender file metadata to DB:", dbErr);
    }
    if (this.onProgress) {
      this.onProgress(fileId, file.name, file.size, file.size, 'upload');
    }
  }

  public disconnect() {
    if (this.idleTimeoutTimer) clearTimeout(this.idleTimeoutTimer);
    this.dataChannel?.close();
    this.pc.close();
  }

  private resetIdleTimer() {
    if (this.idleTimeoutTimer) clearTimeout(this.idleTimeoutTimer);
    this.idleTimeoutTimer = setTimeout(() => {
      this.disconnectReason = 'Connection closed due to 30 minutes of inactivity.';
      this.disconnect();
    }, this.IDLE_TIMEOUT_MS);
  }
}

export class SignalingManager {
  private room: Room | null = null;
  private rtcManager: WebRTCManager;
  private targetPeerId: string | null = null;
  private signalingKey: CryptoKey | null = null;

  constructor(rtcManager: WebRTCManager) {
    this.rtcManager = rtcManager;
  }

  public async join(roomId: string, isCreator: boolean) {
    this.rtcManager.roomId = roomId;
    this.signalingKey = await deriveKeyFromPassword(roomId);
    this.room = joinRoom({ 
      appId: 'p2pear-v1',
      // @ts-ignore: relayUrls is valid for nostr backend but missing from BaseRoomConfig type
      relayUrls: [
        'wss://nos.lol',
        'wss://relay.nostr.band',
        'wss://relay.damus.io',
        'wss://nostr.mutinywallet.com'
      ]
    }, roomId);
    
    // Create a Trystero action to exchange SDP strings
    const sdpAction = this.room.makeAction('sdp') as any;
    const iceAction = this.room.makeAction('ice') as any;

    this.rtcManager.onIceCandidatesBatched = async (candidates) => {
      if (!this.signalingKey) return;
      try {
        const payload = JSON.stringify({ candidates });
        const { ciphertext, iv } = await encryptPayload(this.signalingKey, payload);
        const msg = { encrypted: ciphertext, iv };
        
        if (this.targetPeerId) {
          iceAction.send(msg, { target: this.targetPeerId });
        } else {
          iceAction.send(msg);
        }
      } catch (e) {
        console.error('[Signaling] Failed to encrypt ICE candidates', e);
      }
    };

    iceAction.onMessage = async (raw: any) => {
      if (!this.signalingKey || !raw.encrypted || !raw.iv) return;
      try {
        const decryptedJson = await decryptPayload(this.signalingKey, raw.encrypted, raw.iv);
        const data = JSON.parse(decryptedJson);
        if (data.candidates) {
          await this.rtcManager.addIceCandidates(data.candidates);
        }
      } catch (e) {
        console.debug("[Signaling] Failed to decrypt ICE candidate (invalid key or malformed)", e);
      }
    };

    sdpAction.onMessage = async (raw: any, { peerId }: { peerId: string }) => {
      if (!this.signalingKey || !raw.encrypted || !raw.iv) return;
      this.targetPeerId = peerId;
      try {
        const decryptedJson = await decryptPayload(this.signalingKey, raw.encrypted, raw.iv);
        const data = JSON.parse(decryptedJson);

        if (data.type === 'offer' && !isCreator) {
          const answer = await this.rtcManager.handleOffer(data.sdp);
          
          const answerPayload = JSON.stringify({ type: 'answer', sdp: answer });
          const { ciphertext, iv } = await encryptPayload(this.signalingKey, answerPayload);
          sdpAction.send({ encrypted: ciphertext, iv }, { target: peerId });
          
          this.scheduleLeave();
        } else if (data.type === 'answer' && isCreator) {
          await this.rtcManager.handleAnswer(data.sdp);
          this.scheduleLeave();
        }
      } catch (e) {
        console.debug("[Signaling] Failed to decrypt SDP payload (invalid key or malformed)", e);
      }
    };

    (this.room as any).onPeerJoin = async (peerId: string) => {
      if (isCreator && this.signalingKey) {
        this.targetPeerId = peerId;
        try {
          const offer = await this.rtcManager.generateOffer();
          const offerPayload = JSON.stringify({ type: 'offer', sdp: offer });
          const { ciphertext, iv } = await encryptPayload(this.signalingKey, offerPayload);
          
          sdpAction.send({ encrypted: ciphertext, iv }, { target: peerId });
        } catch (e) {
          console.error('[Signaling] Error sending offer:', e);
        }
      }
    };
  }

  private scheduleLeave() {
    if (!this.room) return;
    
    // Flush any remaining candidates
    this.rtcManager.flushIceCandidates();

    if (this.rtcManager.pc.iceGatheringState === 'complete') {
      setTimeout(() => this.leave(), 1000); // 1s grace period
    } else {
      const listener = () => {
        if (this.rtcManager.pc.iceGatheringState === 'complete') {
          this.rtcManager.pc.removeEventListener('icegatheringstatechange', listener);
          setTimeout(() => this.leave(), 1000);
        }
      };
      this.rtcManager.pc.addEventListener('icegatheringstatechange', listener);
      // Failsafe 25 seconds for mobile networks
      setTimeout(() => {
        this.rtcManager.pc.removeEventListener('icegatheringstatechange', listener);
        this.leave();
      }, 25000);
    }
  }

  public leave() {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
  }
}
