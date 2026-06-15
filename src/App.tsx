import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { WebRTCManager, type ConnectionStatus } from './lib/webrtc';
import { ConnectionManager } from './components/ConnectionManager';
import { Chat } from './components/Chat';
import { FileShare } from './components/FileShare';
import { ReloadPrompt } from './components/ReloadPrompt';
import { LegalView } from './views/LegalView';
import { SeoLandingView } from './views/SeoLandingView';
import { UseCasesView } from './views/UseCasesView';
import { clearWorkspace, wipeOnNewSession, syncChannel, getMessages } from './lib/db';
import { playMessageChime, showSystemNotification } from './lib/notifications';
import { ShieldAlert, MessageSquare, AlertCircle } from 'lucide-react';
import './index.css';

function App() {
  const [rtcManager, setRtcManager] = useState<WebRTCManager | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasBeenConnected, setHasBeenConnected] = useState(false);
  const prevMsgCount = useRef(0);

  useEffect(() => {
    wipeOnNewSession();

    const manager = new WebRTCManager(
      (newStatus, error) => {
        setStatus(newStatus);
        if (newStatus === 'connected') {
          setHasBeenConnected(true);
        }
        if (error) setErrorMessage(error);
      },
      () => {
        // Trigger UI update when new data arrives
        setRefreshTrigger(prev => prev + 1);
      }
    );
    setRtcManager(manager);

    syncChannel.onmessage = (event) => {
      if (event.data.type === 'takeover') {
        manager.disconnectReason = 'Session paused because P2Pear was opened in another tab.';
        manager.disconnect();
      }
    };

    return () => {
      manager.disconnect();
      // syncChannel is a singleton now, do not close it
    };
  }, []);

  useEffect(() => {
    if (status !== 'connected') return;

    getMessages().then(msgs => {
      if (msgs.length > prevMsgCount.current) {
        if (!isChatOpen) {
          setUnreadCount(prev => prev + (msgs.length - prevMsgCount.current));
          playMessageChime();
          showSystemNotification("New message received");
        }
      }
      prevMsgCount.current = msgs.length;
    });
  }, [refreshTrigger, isChatOpen, status]);

  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);

  useEffect(() => {
    if (status !== 'connected') {
      setUnreadCount(0);
      prevMsgCount.current = 0;
    }
  }, [status]);

  // Prevent accidental reloads when connected
  useEffect(() => {
    if (status !== 'connected') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Required for modern browsers to show the prompt
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status]);

  const handleDestroy = async () => {
    if (confirm("Are you sure? This will delete all chats and files from your device forever.")) {
      rtcManager?.disconnect();
      await clearWorkspace();
      sessionStorage.removeItem('swarmgrid-session-active');
      window.location.reload();
    }
  };

  return (
    <>
      <ReloadPrompt />
      <Routes>
        <Route path="/" element={
        <div className={`app-layout ${status !== 'connected' ? 'app-layout-landing' : ''}`}>
          <header className="app-header">
            <Link to="/" className="logo" style={{ textDecoration: 'none', color: 'inherit' }}>
              <img src="/favicon.png" alt="P2Pear" style={{ width: 36, height: 36 }} />
              <span className="logo-text">P2Pear</span>
            </Link>
            {status === 'connected' && (
              <button className="btn btn-danger" onClick={handleDestroy}>
                <ShieldAlert size={18} /> Delete everything &amp; exit
              </button>
            )}
          </header>

          <main className="app-main">
            {!hasBeenConnected && status !== 'connected' ? (
              <ConnectionManager
                rtcManager={rtcManager}
                status={status}
                errorMessage={errorMessage}
                onConnected={() => setStatus('connected')}
              />
            ) : (
              <div className="unified-workspace" style={{ display: 'flex', flexDirection: 'column' }}>
                {status !== 'connected' && (
                  <div className="offline-banner alert-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 2rem 1rem 2rem', padding: '1rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertCircle size={20} color="#ef4444" />
                      <span style={{ color: '#ef4444' }}><strong>Connection lost.</strong> You are now offline. You can still save your downloaded files.</span>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={handleDestroy} style={{ margin: 0, padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                      Start New Session
                    </button>
                  </div>
                )}
                
                <FileShare rtcManager={rtcManager!} refreshTrigger={refreshTrigger} status={status} />

                <div className={`chat-drawer ${isChatOpen ? 'open' : ''}`}>
                  <Chat rtcManager={rtcManager!} refreshTrigger={refreshTrigger} onClose={() => setIsChatOpen(false)} isOpen={isChatOpen} status={status} />
                </div>

                <button className={`fab-chat ${isChatOpen ? 'hidden-fab' : ''}`} onClick={() => setIsChatOpen(true)} aria-label="Open Chat">
                  <MessageSquare size={24} />
                  {unreadCount > 0 && (
                    <span className="unread-badge">{unreadCount}</span>
                  )}
                </button>
              </div>
            )}
          </main>

          {status !== 'connected' && (
            <footer className="app-footer">
              <p className="app-footer-copy">© 2026 P2Pear</p>
              <div className="app-footer-row">
                <Link to="/snapdrop-alternative" style={{ color: 'inherit', textDecoration: 'none' }}>Snapdrop Alternative</Link>
                <Link to="/wetransfer-alternative" style={{ color: 'inherit', textDecoration: 'none' }}>WeTransfer Alternative</Link>
                <Link to="/sharedrop-alternative" style={{ color: 'inherit', textDecoration: 'none' }}>ShareDrop Alternative</Link>
              </div>
              <div className="app-footer-row">
                <Link to="/use-cases" style={{ color: 'inherit', textDecoration: 'none' }}>Use Cases</Link>
                <Link to="/about" style={{ color: 'inherit', textDecoration: 'none' }}>About</Link>
                <Link to="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</Link>
                <Link to="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Service</Link>
              </div>
            </footer>
          )}
        </div>
      } />
      <Route path="/about" element={<LegalView page="about" />} />
      <Route path="/use-cases" element={<UseCasesView />} />
      <Route path="/privacy" element={<LegalView page="privacy" />} />
      <Route path="/terms" element={<LegalView page="terms" />} />
      <Route path="/snapdrop-alternative" element={<SeoLandingView competitor="Snapdrop" />} />
      <Route path="/wetransfer-alternative" element={<SeoLandingView competitor="WeTransfer" />} />
      <Route path="/sharedrop-alternative" element={<SeoLandingView competitor="ShareDrop" />} />
    </Routes>
    </>
  );
}

export default App;
