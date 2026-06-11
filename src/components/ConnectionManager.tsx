import React, { useState, useEffect } from 'react';
import { Plus, Link as LinkIcon, CheckCircle2, QrCode, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { WebRTCManager, type ConnectionStatus } from '../lib/webrtc';
import { clearWorkspace } from '../lib/db';

interface ConnectionManagerProps {
  rtcManager: WebRTCManager | null;
  status: ConnectionStatus;
  onConnected: () => void;
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({ rtcManager, status }) => {
  const [offerStr, setOfferStr] = useState('');
  const [answerStr, setAnswerStr] = useState('');
  const [inputStr, setInputStr] = useState('');
  const [mode, setMode] = useState<'idle' | 'creating' | 'joining' | 'connecting'>('idle');
  const [loadingAction, setLoadingAction] = useState<'create' | 'join' | 'connect' | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedString, setCopiedString] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Parse Magic Link from URL
  useEffect(() => {
    const initFromHash = async () => {
      if (rtcManager && window.location.hash.length > 50 && mode === 'idle') {
        const hash = window.location.hash.substring(1);
        try {
          setLoadingAction('join');
          await clearWorkspace(); // Wipe old data!
          const answer = await rtcManager.handleOffer(hash);
          setAnswerStr(answer);
          setMode('joining');
          window.history.replaceState(null, '', window.location.pathname);
        } catch (e) {
          console.error('Failed to parse URL hash offer', e);
        } finally {
          setLoadingAction(null);
        }
      }
    };
    initFromHash();
  }, [rtcManager, mode]);

  const handleCreateGrid = async () => {
    if (!rtcManager) return;
    setLoadingAction('create');
    await clearWorkspace(); // Wipe old data!
    try {
      const offer = await rtcManager.generateOffer();
      setOfferStr(offer);
      setMode('creating');
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleJoinGrid = async () => {
    if (!rtcManager || !inputStr) return;
    setLoadingAction(mode === 'creating' ? 'connect' : 'join');

    // Auto-extract the payload if user accidentally pasted the full URL
    let parsedInput = inputStr.trim();
    if (parsedInput.includes('#')) {
      parsedInput = parsedInput.split('#').pop() || parsedInput;
    }

    try {
      if (mode === 'creating') {
        await rtcManager.handleAnswer(parsedInput);
        setMode('connecting');
      } else {
        await clearWorkspace(); // Wipe old data!
        const answer = await rtcManager.handleOffer(parsedInput);
        setAnswerStr(answer);
        setMode('joining');
      }
    } catch (e) {
      console.error(e);
      alert("That link didn't work. Please check it and try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCopy = (text: string, isLink: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isLink) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedString(true);
      setTimeout(() => setCopiedString(false), 2000);
    }
  };

  if (status === 'connected') return null;

  const magicLink = offerStr ? `${window.location.origin}${window.location.pathname}#${offerStr}` : '';

  return (
    <div className="connection-container">
      <div className="glass-panel connection-panel">
        <h1 className="title-gradient">P2Pear</h1>
        <p className="subtitle">Send large files instantly between any devices. 100% free, secure, and serverless.</p>

        {status === 'error' && (
          <div className="alert-danger fade-in">
            <AlertCircle size={20} />
            Connection failed. Please check the link and try again.
          </div>
        )}

        {mode === 'idle' && (
          <div className="flex-col">
            <button className="btn btn-primary w-full" onClick={handleCreateGrid} disabled={!!loadingAction}>
              {loadingAction === 'create' ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
              <span>{loadingAction === 'create' ? 'Creating link...' : 'Create a link'}</span>
            </button>
            <div className="divider">OR</div>
            <div className="flex-row">
              <input
                className="input flex-1"
                placeholder="Paste a link here..."
                value={inputStr}
                onChange={e => setInputStr(e.target.value)}
              />
              <button className="btn" onClick={handleJoinGrid} disabled={!inputStr || !!loadingAction}>
                {loadingAction === 'join' ? <Loader2 size={20} className="animate-spin" /> : <LinkIcon size={20} />} 
                <span>{loadingAction === 'join' ? 'Joining...' : 'Join'}</span>
              </button>
            </div>
          </div>
        )}

        {mode === 'creating' && (
          <div className="flex-col text-left">
            <h2>Step 1: Share your link</h2>
            <p className="text-sm text-zinc-400 mb-2">Send this link to the person you want to connect with.</p>
            <div className="flex-row mb-md">
              <input className="input flex-1 mono-text" readOnly value={magicLink} />
              <button className="btn btn-primary" onClick={() => handleCopy(magicLink, true)}>
                {copiedLink ? <CheckCircle2 size={20} /> : 'Copy link'}
              </button>
              <button className="btn btn-icon" aria-label="Toggle QR Code" onClick={() => setShowQR(!showQR)}>
                <QrCode size={20} />
              </button>
            </div>

            {showQR && (
              <div className="qr-container">
                <QRCodeSVG value={magicLink} size={200} />
              </div>
            )}

            <h2>Step 2: Paste the code they send back</h2>
            <div className="flex-row">
              <input
                className="input flex-1 mono-text"
                placeholder="Paste their code here..."
                value={inputStr}
                onChange={e => setInputStr(e.target.value)}
              />
              <button className="btn btn-primary" onClick={handleJoinGrid} disabled={!inputStr || !!loadingAction}>
                {loadingAction === 'connect' ? <Loader2 size={20} className="animate-spin" /> : null}
                <span>{loadingAction === 'connect' ? 'Connecting...' : 'Connect'}</span>
              </button>
            </div>
          </div>
        )}

        {mode === 'joining' && answerStr && (
          <div className="flex-col text-left">
            <h2>Send this code back</h2>
            <p className="text-sm text-zinc-400 mb-2">Send this text back to the person who invited you.</p>
            <div className="flex-row mb-md">
              <input className="input flex-1 mono-text" readOnly value={answerStr} />
              <button className="btn btn-primary" onClick={() => handleCopy(answerStr)}>
                {copiedString ? <CheckCircle2 size={20} /> : 'Copy code'}
              </button>
              <button className="btn btn-icon" aria-label="Toggle QR Code" onClick={() => setShowQR(!showQR)}>
                <QrCode size={20} />
              </button>
            </div>

            {showQR && (
              <div className="qr-container">
                <QRCodeSVG value={answerStr} size={200} />
              </div>
            )}

            <p className="status-text pulse text-center mt-4">Waiting for your friend to connect...</p>
          </div>
        )}

        {mode === 'connecting' && (
          <div className="flex-col text-center">
            <h2>Connecting...</h2>
            <p className="text-sm text-zinc-400 mt-2">Linking your devices directly to each other.</p>
            <p className="status-text pulse mt-4">Please wait...</p>
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
