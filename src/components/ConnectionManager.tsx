import React, { useState, useEffect } from 'react';
import { Plus, Link as LinkIcon, CheckCircle2, QrCode, Lock } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedString, setCopiedString] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Parse Magic Link from URL
  useEffect(() => {
    const initFromHash = async () => {
      if (rtcManager && window.location.hash.length > 50 && mode === 'idle') {
        const hash = window.location.hash.substring(1);
        try {
          setLoading(true);
          await clearWorkspace(); // Wipe old data!
          const answer = await rtcManager.handleOffer(hash);
          setAnswerStr(answer);
          setMode('joining');
          window.history.replaceState(null, '', window.location.pathname);
        } catch (e) {
          console.error('Failed to parse URL hash offer', e);
        } finally {
          setLoading(false);
        }
      }
    };
    initFromHash();
  }, [rtcManager, mode]);

  const handleCreateGrid = async () => {
    if (!rtcManager) return;
    setLoading(true);
    await clearWorkspace(); // Wipe old data!
    try {
      const offer = await rtcManager.generateOffer();
      setOfferStr(offer);
      setMode('creating');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGrid = async () => {
    if (!rtcManager || !inputStr) return;
    setLoading(true);

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
      setLoading(false);
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
        <p className="subtitle">Share files and connect with anyone. Fast, safe, and simple.</p>

        {status === 'error' && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-lg mb-6">
            Connection failed. Please try again.
          </div>
        )}

        {mode === 'idle' && (
          <div className="flex-col">
            <button className="btn btn-primary w-full" onClick={handleCreateGrid} disabled={loading}>
              <Plus size={24} /> Create a link
            </button>
            <div className="divider">OR</div>
            <div className="flex-row">
              <input
                className="input flex-1"
                placeholder="Paste a link here..."
                value={inputStr}
                onChange={e => setInputStr(e.target.value)}
              />
              <button className="btn" onClick={() => { setMode('joining'); handleJoinGrid(); }} disabled={!inputStr || loading}>
                <LinkIcon size={20} /> Join
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
              <button className="btn btn-primary" onClick={handleJoinGrid} disabled={!inputStr || loading}>
                Connect
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
        <div className="trust-footer fade-in">
          <h2 style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '1.1rem', margin: '0 0 1rem 0' }}>Why P2Pear is 100% safe</h2>
          <ul className="trust-list">
            <li className="trust-item">
              <CheckCircle2 size={18} className="trust-icon" /> 
              <span><strong>No servers:</strong> Your files go straight from your device to your friend's device. They never touch a cloud.</span>
            </li>
            <li className="trust-item">
              <CheckCircle2 size={18} className="trust-icon" /> 
              <span><strong>Completely private:</strong> Everything is locked with a secret key. Nobody else can see your chats or files.</span>
            </li>
            <li className="trust-item">
              <CheckCircle2 size={18} className="trust-icon" /> 
              <span><strong>No traces left behind:</strong> When you close this page, all your messages and files are deleted forever.</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
