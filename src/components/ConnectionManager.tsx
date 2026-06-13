import React, { useState, useEffect, useRef } from 'react';
import { Plus, Link as LinkIcon, CheckCircle2, QrCode, Lock, AlertCircle, Loader2, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { WebRTCManager, SignalingManager, type ConnectionStatus } from '../lib/webrtc';
import { clearWorkspace, syncChannel } from '../lib/db';

interface ConnectionManagerProps {
  rtcManager: WebRTCManager | null;
  status: ConnectionStatus;
  errorMessage?: string;
  onConnected: () => void;
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({ rtcManager, status, errorMessage }) => {
  const [roomId, setRoomId] = useState('');
  const [inputStr, setInputStr] = useState('');
  const [mode, setMode] = useState<'idle' | 'creating' | 'joining' | 'expired' | 'not_found'>('idle');
  const [joinPhase, setJoinPhase] = useState<number>(0);
  const [loadingAction, setLoadingAction] = useState<'create' | 'join' | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const sigManagerRef = useRef<SignalingManager | null>(null);

  const takeoverAndClear = async () => {
    syncChannel.postMessage({ type: 'takeover' });
    await clearWorkspace();
  };

  // Parse Magic Link from URL
  useEffect(() => {
    const initFromUrl = async () => {
      if (rtcManager && mode === 'idle') {
        const urlParams = new URLSearchParams(window.location.search);
        let roomCode = urlParams.get('room');
        
        // Backward compatibility with older hash links
        if (!roomCode && window.location.hash.length > 1) {
          roomCode = window.location.hash.substring(1);
        }

        if (roomCode && roomCode.length <= 20) {
          try {
            setLoadingAction('join');
            await takeoverAndClear(); // Broadcast takeover & wipe old data!
            
            sigManagerRef.current = new SignalingManager(rtcManager);
            sigManagerRef.current.join(roomCode.toUpperCase(), false);
            
            setRoomId(roomCode.toUpperCase());
            setMode('joining');
            window.history.replaceState(null, '', window.location.pathname);
          } catch (e) {
            console.error('Failed to join room from URL', e);
          } finally {
            setLoadingAction(null);
          }
        }
      }
    };
    initFromUrl();
  }, [rtcManager, mode]);

  // Timeouts for Link Expiration and Progressive Join Feedback
  useEffect(() => {
    let timeout: any;
    let phase1Timer: any;
    let phase2Timer: any;

    if (mode === 'creating') {
      timeout = setTimeout(() => {
        setMode('expired');
        if (sigManagerRef.current) {
          sigManagerRef.current.leave();
        }
      }, 10 * 60 * 1000); // 10 minutes
    } else if (mode === 'joining') {
      setJoinPhase(0);
      
      // Update text after 10 seconds (Slow Network / Firewall Traversal)
      phase1Timer = setTimeout(() => {
        setJoinPhase(1);
      }, 10 * 1000);

      // Update text after 25 seconds (Sleeping Device / Background Tab)
      phase2Timer = setTimeout(() => {
        setJoinPhase(2);
      }, 25 * 1000);

      // Final failure at 45 seconds
      timeout = setTimeout(() => {
        setMode('not_found');
        if (sigManagerRef.current) {
          sigManagerRef.current.leave();
        }
      }, 45 * 1000); 
    }
    return () => {
      clearTimeout(timeout);
      clearTimeout(phase1Timer);
      clearTimeout(phase2Timer);
    };
  }, [mode]);

  const handleCreateGrid = async () => {
    if (!rtcManager) return;
    setLoadingAction('create');
    await takeoverAndClear(); // Broadcast takeover & wipe old data!
    try {
      // Generate a short 6-character alphanumeric room ID for optimal early UX.
      // FUTURE BACKUP: If the app scales to >50k concurrent users, consider switching 
      // to an 8-character or 3-word dictionary format to prevent math collisions.
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      sigManagerRef.current = new SignalingManager(rtcManager);
      sigManagerRef.current.join(newRoomId, true);
      
      setRoomId(newRoomId);
      setMode('creating');
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleJoinGrid = async () => {
    if (!rtcManager || !inputStr) return;
    setLoadingAction('join');

    // Auto-extract the room ID if user accidentally pasted the full URL
    let parsedInput = inputStr.trim();
    const match = parsedInput.match(/[?&]ROOM=([^&]+)/i);
    if (match) {
      parsedInput = match[1];
    } else if (parsedInput.includes('#')) {
      parsedInput = parsedInput.split('#').pop() || parsedInput;
    }

    try {
      await takeoverAndClear(); // Broadcast takeover & wipe old data!
      sigManagerRef.current = new SignalingManager(rtcManager);
      sigManagerRef.current.join(parsedInput.toUpperCase(), false);
      
      setRoomId(parsedInput.toUpperCase());
      setMode('joining');
    } catch (e) {
      console.error(e);
      alert("That link didn't work. Please check it and try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (status === 'connected') return null;

  const magicLink = roomId ? `${window.location.origin}${window.location.pathname}?room=${roomId}` : '';

  return (
    <div className="connection-container">
      <div className="glass-panel connection-panel">
        <h1 className="title-gradient">P2Pear</h1>
        <p className="subtitle">Instant, serverless file transfers. 100% free.</p>

        {status === 'error' && (
          <div className="alert-danger fade-in">
            <AlertCircle size={20} />
            {errorMessage || 'Connection failed. Please try creating a new link.'}
          </div>
        )}

        {mode === 'idle' && (
          <div className="flex-col fade-in">
            <button className="btn btn-primary w-full" onClick={handleCreateGrid} disabled={!!loadingAction}>
              {loadingAction === 'create' ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
              <span>{loadingAction === 'create' ? 'Creating room...' : 'Create a room'}</span>
            </button>
            <div className="divider" style={{ margin: '1.5rem 0' }}>OR</div>
            <div className="inline-input-group">
              <input
                className="input uppercase"
                placeholder="Paste room code or link..."
                value={inputStr}
                onChange={e => setInputStr(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && inputStr && handleJoinGrid()}
              />
              <button className="btn" onClick={handleJoinGrid} disabled={!inputStr || !!loadingAction}>
                {loadingAction === 'join' ? <Loader2 size={20} className="animate-spin" /> : <LinkIcon size={20} />} 
                <span>Join</span>
              </button>
            </div>
          </div>
        )}

        {mode === 'creating' && (
          <div className="flex-col fade-in" style={{ alignItems: 'center' }}>
            <h2 style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Share this code</h2>
            
            <div className="code-badge-container">
              <div className="code-badge" onClick={() => handleCopy(magicLink)}>
                <span>{roomId}</span>
                {copiedLink ? <CheckCircle2 size={32} className="color-success" /> : <Copy size={32} className="code-badge-icon" />}
              </div>
              <div className="copy-hint">{copiedLink ? 'Copied to clipboard!' : 'Click to copy direct link'}</div>
            </div>

            <button className="btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }} onClick={() => setShowQR(!showQR)}>
              <QrCode size={18} />
              <span>{showQR ? 'Hide QR Code' : 'Show QR Code'}</span>
            </button>

            {showQR && (
              <div className="qr-container fade-in mt-2 mb-2">
                <QRCodeSVG value={magicLink} size={180} />
              </div>
            )}

            <div className="connecting-ring"></div>
            <p className="status-text pulse text-center">Waiting for peer to connect...</p>
          </div>
        )}

        {mode === 'joining' && (
          <div className="flex-col text-center fade-in items-center" style={{ gap: '1rem' }}>
            <div className="connecting-ring"></div>
            <h2>Joining Room {roomId}</h2>
            <div style={{ color: 'var(--text-secondary)', minHeight: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '320px', margin: '0 auto', transition: 'opacity 0.3s ease' }} className="fade-in" key={joinPhase}>
              {joinPhase === 0 && "Linking your devices directly via WebRTC..."}
              {joinPhase === 1 && "Connection taking longer than usual. Negotiating firewalls..."}
              {joinPhase === 2 && "Still searching... Please ensure the creator's tab is active and open."}
            </div>
          </div>
        )}

        {mode === 'expired' && (
          <div className="flex-col text-center fade-in items-center" style={{ gap: '1rem' }}>
            <div className="alert-danger" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1.5rem', borderRadius: '1rem' }}>
              <AlertCircle size={32} color="#ef4444" />
              <h2 style={{ color: '#ef4444', fontWeight: 600 }}>Room Code Expired</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                For your security, room codes automatically expire after 10 minutes if no one connects.
              </p>
            </div>
            <button className="btn btn-primary w-full mt-2" onClick={() => setMode('idle')}>
              Generate New Code
            </button>
          </div>
        )}

        {mode === 'not_found' && (
          <div className="flex-col text-center fade-in items-center" style={{ gap: '1rem' }}>
            <div className="alert-danger" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1.5rem', borderRadius: '1rem' }}>
              <AlertCircle size={32} color="#ef4444" />
              <h2 style={{ color: '#ef4444', fontWeight: 600 }}>Room Not Found</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                This room link is invalid, expired, or has already been used. P2Pear rooms are single-use and disappear instantly once closed.
              </p>
            </div>
            <button className="btn btn-primary w-full mt-2" onClick={() => {
              setMode('idle');
              setInputStr('');
              // Clean up the URL
              window.history.replaceState(null, '', window.location.pathname);
            }}>
              Return to Home
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2.5rem', opacity: 0.7 }}>
          <Lock size={14} />
          <span>End-to-end encrypted</span>
        </div>
      </div>

      {mode === 'idle' && (
        <div className="faq-container fade-in">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "How does P2Pear send large files for free?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "P2Pear uses WebRTC to create a direct peer-to-peer connection between your devices. Because your files never touch a cloud server, there are no bandwidth limits or costs."
                }
              },
              {
                "@type": "Question",
                "name": "Is there a file size limit?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "No. Since there are no servers involved, you can send unlimited file sizes—from a 10MB photo to a 100GB video folder."
                }
              },
              {
                "@type": "Question",
                "name": "Is my data secure?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes. Every file transfer is secured with end-to-end encryption. Only the receiving device has the key to decrypt your files."
                }
              }
            ]
          })}} />
          <h2 className="faq-title">Frequently Asked Questions</h2>
          <details className="faq-item">
            <summary>How does P2Pear send large files for free?</summary>
            <p>P2Pear uses WebRTC to create a direct peer-to-peer connection between your devices. Because your files never touch a cloud server, there are no bandwidth limits or costs.</p>
          </details>
          <details className="faq-item">
            <summary>Is there a file size limit?</summary>
            <p>No. Since there are no servers involved, you can send unlimited file sizes—from a 10MB photo to a 100GB video folder.</p>
          </details>
          <details className="faq-item">
            <summary>Is my data secure?</summary>
            <p>Yes. Every file transfer is secured with end-to-end encryption. Only the receiving device has the key to decrypt your files.</p>
          </details>
        </div>
      )}
    </div>
  );
};
