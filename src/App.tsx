import { useState, useEffect } from 'react';
import { WebRTCManager, type ConnectionStatus } from './lib/webrtc';
import { ConnectionManager } from './components/ConnectionManager';
import { Chat } from './components/Chat';
import { FileShare } from './components/FileShare';
import { clearWorkspace, wipeOnNewSession } from './lib/db';
import { ShieldAlert } from 'lucide-react';
import './index.css';

function App() {
  const [rtcManager, setRtcManager] = useState<WebRTCManager | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    wipeOnNewSession();

    const manager = new WebRTCManager(
      (newStatus, error) => {
        setStatus(newStatus);
        if (error) console.error(error);
      },
      () => {
        // Trigger UI update when new data arrives
        setRefreshTrigger(prev => prev + 1);
      }
    );
    setRtcManager(manager);

    return () => {
      manager.disconnect();
    };
  }, []);

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
    <div className="app-layout">
      <header className="app-header">
        <a href="/" className="logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <img src="/favicon.svg" alt="P2Pear" style={{ width: 24, height: 24 }} />
          <span className="logo-text">P2Pear</span>
        </a>
        {status === 'connected' && (
          <button className="btn btn-danger" onClick={handleDestroy}>
            <ShieldAlert size={18} /> Delete everything & exit
          </button>
        )}
      </header>

      <main className="app-main">
        {status !== 'connected' ? (
          <ConnectionManager 
            rtcManager={rtcManager} 
            status={status} 
            onConnected={() => setStatus('connected')} 
          />
        ) : (
          <div className="workspace-grid">
            <Chat rtcManager={rtcManager!} refreshTrigger={refreshTrigger} />
            <FileShare rtcManager={rtcManager!} refreshTrigger={refreshTrigger} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
