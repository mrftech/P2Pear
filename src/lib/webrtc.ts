import { generateKeyPair, exportPublicKey, importPublicKey, deriveSharedKey, encryptPayload, decryptPayload, encryptChunk, decryptChunk } from './crypto';
import { addMessage, addFile, type SharedFile } from './db';

// Compression Utility for shorter Base64 Strings
async function compressData(jsonStr: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') {
    return 'RAW:' + btoa(jsonStr);
  }
  try {
    const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('deflate'));
    const buffer = await new Response(stream).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binaryStr = '';
    for (let i = 0; i < bytes.length; i++) {
      binaryStr += String.fromCharCode(bytes[i]);
    }
    return btoa(binaryStr);
  } catch (e) {
    return 'RAW:' + btoa(jsonStr);
  }
}

async function decompressData(b64Str: string): Promise<string> {
  if (b64Str.startsWith('RAW:')) {
    return atob(b64Str.substring(4));
  }
  try {
    const binaryStr = atob(b64Str);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    return await new Response(stream).text();
  } catch (e) {
    // Fallback to uncompressed string for backwards compatibility or failed decompression
    try {
      const decoded = atob(b64Str);
      if (decoded.trim().startsWith('{')) return decoded;
    } catch {}
    throw e;
  }
}
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type ConnectionCallback = (status: ConnectionStatus, error?: string) => void;
export type MessageCallback = () => void;
export type ProgressCallback = (fileId: string, name: string, bytes: number, total: number, type: 'upload' | 'download') => void;

export class WebRTCManager {
  public pc: RTCPeerConnection;
  public dataChannel?: RTCDataChannel;
  public onConnectionStatusChange: ConnectionCallback;
  private onNewData: MessageCallback;
  public onProgress?: ProgressCallback;
  private ecdhKeyPair: CryptoKeyPair | null = null;
  private sharedKey: CryptoKey | null = null;
  private ackListeners: { [fileId: string]: (ackIndex: number) => void } = {};

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
      console.log('[WebRTC] OPFS Worker initialized.');
    } catch (e) {
      console.warn('[WebRTC] Failed to initialize OPFS Worker. Will fallback to RAM.', e);
    }
    
    // Using public STUN servers for NAT traversal
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.relay.metered.ca:80' },
        { 
          urls: [
            'turn:global.relay.metered.ca:80',
            'turn:global.relay.metered.ca:80?transport=tcp',
            'turn:global.relay.metered.ca:443?transport=tcp'
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    });

    this.pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE Connection State:', this.pc.iceConnectionState);
      if (this.pc.iceConnectionState === 'failed') {
        this.onConnectionStatusChange('error', 'Connection failed');
      }
    };

    this.pc.onsignalingstatechange = () => {
      console.log('[WebRTC] Signaling State:', this.pc.signalingState);
    };

    this.pc.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE Gathering State:', this.pc.iceGatheringState);
    };

    this.pc.ondatachannel = (event) => {
      console.log('[WebRTC] Received remote DataChannel');
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;
    this.dataChannel.binaryType = 'arraybuffer';
    this.dataChannel.bufferedAmountLowThreshold = 65536; // 64KB threshold for event firing
    
    const handleOpen = () => {
      console.log('[DataChannel] Opened!');
      this.onConnectionStatusChange('connected');
    };

    if (this.dataChannel.readyState === 'open') {
      handleOpen();
    } else {
      this.dataChannel.onopen = handleOpen;
    }

    this.dataChannel.onclose = () => {
      console.log('[DataChannel] Closed!');
      this.onConnectionStatusChange('error', 'Connection closed');
    };

    this.dataChannel.onmessage = async (event) => {
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
                    console.log(`[WebRTC] OPFS stream created via Worker for ${data.name}`);
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
          state.ramFallback.push(chunk.data);
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
          console.log(`[WebRTC] File saved to OPFS successfully`);
        } catch (opfsErr) {
          console.error(`[WebRTC] Could not get file handle after worker close:`, opfsErr);
        }
      } else {
        finalBlob = new Blob(state.ramFallback as any[], { type: state.meta.type });
        console.log(`[WebRTC] File assembled in RAM successfully`);
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

  public async generateOffer(): Promise<string> {
    console.log('[WebRTC] Generating Offer...');
    this.ecdhKeyPair = await generateKeyPair();
    const publicKeyBase64 = await exportPublicKey(this.ecdhKeyPair.publicKey);

    this.dataChannel = this.pc.createDataChannel('swarm-grid');
    console.log('[WebRTC] Created local DataChannel');
    this.setupDataChannel();

    const offer = await this.pc.createOffer();
    console.log('[WebRTC] Created Offer SDP');
    await this.pc.setLocalDescription(offer);

    const candidates: RTCIceCandidateInit[] = [];

    // Wait for ICE gathering
    console.log('[WebRTC] Waiting for ICE candidates...');
    await new Promise<void>((resolve) => {
      let isResolved = false;
      const doResolve = () => {
        if (isResolved) return;
        isResolved = true;
        this.pc.removeEventListener('icecandidate', checkState);
        this.pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      };

      const checkState = (e?: any) => {
        if (e && e.candidate) {
          candidates.push(e.candidate.toJSON());
          // Smart early exit: TURN candidates guarantee NAT traversal
          if (e.candidate.type === 'relay') {
            doResolve();
          }
        }
        if (this.pc.iceGatheringState === 'complete' || (e && e.candidate === null)) {
          doResolve();
        }
      };
      
      this.pc.addEventListener('icecandidate', checkState);
      this.pc.addEventListener('icegatheringstatechange', checkState);
      
      // Increased failsafe timeout to 2500ms for Firefox's slower STUN/TURN engine
      setTimeout(doResolve, 2500);
    });

    const payload = {
      sdp: this.pc.localDescription,
      candidates: candidates,
      publicKey: publicKeyBase64
    };
    console.log('[WebRTC] Offer generated with ICE gathering state:', this.pc.iceGatheringState);

    return await compressData(JSON.stringify(payload));
  }

  public async handleOffer(offerStrBase64: string): Promise<string> {
    try {
      console.log('[WebRTC] Handling remote Offer...');
      const payload = JSON.parse(await decompressData(offerStrBase64));
      
      this.ecdhKeyPair = await generateKeyPair();
      const myPublicKeyBase64 = await exportPublicKey(this.ecdhKeyPair.publicKey);
      
      const peerPublicKey = await importPublicKey(payload.publicKey);
      this.sharedKey = await deriveSharedKey(this.ecdhKeyPair.privateKey, peerPublicKey);
      console.log('[WebRTC] ECDH Shared Key derived');

      await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      console.log('[WebRTC] Remote description set');
      
      if (payload.candidates) {
        for (const candidate of payload.candidates) {
          try { await this.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
        }
      }

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      console.log('[WebRTC] Created Answer SDP, waiting for ICE...');

      const candidates: RTCIceCandidateInit[] = [];

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        let isResolved = false;
        const doResolve = () => {
          if (isResolved) return;
          isResolved = true;
          this.pc.removeEventListener('icecandidate', checkState);
          this.pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        };

        const checkState = (e?: any) => {
          if (e && e.candidate) {
            candidates.push(e.candidate.toJSON());
            if (e.candidate.type === 'relay') {
              doResolve();
            }
          }
          if (this.pc.iceGatheringState === 'complete' || (e && e.candidate === null)) {
            doResolve();
          }
        };
        
        this.pc.addEventListener('icecandidate', checkState);
        this.pc.addEventListener('icegatheringstatechange', checkState);
        setTimeout(doResolve, 2500);
      });

      const answerPayload = {
        sdp: this.pc.localDescription,
        candidates: candidates,
        publicKey: myPublicKeyBase64
      };

      return await compressData(JSON.stringify(answerPayload));
    } catch (e) {
      console.error(e);
      this.onConnectionStatusChange('error', 'Invalid Offer string.');
      throw e;
    }
  }

  public async handleAnswer(answerStrBase64: string) {
    try {
      console.log('[WebRTC] Handling remote Answer...');
      const payload = JSON.parse(await decompressData(answerStrBase64));
      const peerPublicKey = await importPublicKey(payload.publicKey);
      
      if (!this.ecdhKeyPair) throw new Error("Local key pair not found.");
      
      if (this.pc.signalingState !== 'have-local-offer') {
        throw new Error(`Expected signaling state "have-local-offer", but got "${this.pc.signalingState}". This usually happens if the page was hot-reloaded or the connection was reset. Please refresh the page and try again.`);
      }

      this.sharedKey = await deriveSharedKey(this.ecdhKeyPair.privateKey, peerPublicKey);
      console.log('[WebRTC] ECDH Shared Key derived');
      
      await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      
      if (payload.candidates) {
        for (const candidate of payload.candidates) {
          try { await this.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
        }
      }
      
      console.log('[WebRTC] Remote description and candidates set successfully. Connecting...');
    } catch (e) {
      console.error('[WebRTC] Error in handleAnswer:', e);
      this.onConnectionStatusChange('error', 'Invalid Answer string.');
      throw e;
    }
  }

  public async sendChat(text: string) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open' || !this.sharedKey) {
      throw new Error("Connection not open.");
    }

    const { ciphertext, iv } = await encryptPayload(this.sharedKey, text);
    const msg = JSON.stringify({ type: 'chat', ciphertext, iv });
    
    this.dataChannel.send(msg);
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
    };

    while (true) {
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
    await addFile({
      id: fileId,
      name: file.name,
      type: file.type,
      size: file.size,
      blob: file,
      sender: 'me',
      timestamp: Date.now()
    });
    this.onNewData();
    if (this.onProgress) {
      this.onProgress(fileId, file.name, file.size, file.size, 'upload');
    }
  }

  public disconnect() {
    this.dataChannel?.close();
    this.pc.close();
  }
}
