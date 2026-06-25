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
import { MessageSquare, AlertCircle, LogOut } from 'lucide-react';
import './index.css';

function App() {
  const [rtcManager, setRtcManager] = useState<WebRTCManager | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasBeenConnected, setHasBeenConnected] = useState(false);
  const [isDestroying, setIsDestroying] = useState(false);
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
    if (confirm("End secure session? All shared files and chat history will be securely wiped from this device.")) {
      setIsDestroying(true);
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
              <button className="btn btn-end-session" onClick={handleDestroy}>
                <LogOut size={18} /> End Session
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
                {status !== 'connected' && !isDestroying && (
                  <div className="offline-status">
                    <div className="offline-status-content">
                      <AlertCircle size={20} className="toast-icon" />
                      <div className="offline-status-text">
                        <strong>Peer disconnected</strong>
                        <span className="offline-subtext">You can still save received files.</span>
                      </div>
                    </div>
                    <button className="btn btn-outline" onClick={handleDestroy} style={{ margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.85rem', flexShrink: 0 }}>
                      Return Home
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
                <a href="https://github.com/mrftech/P2Pear" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>GitHub</a>
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
