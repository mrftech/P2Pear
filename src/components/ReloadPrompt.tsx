import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  const close = () => {
    setNeedRefresh(false);
  };

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      backgroundColor: '#18181b',
      color: '#fff',
      padding: '16px 20px',
      borderRadius: '8px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      zIndex: 9999,
      border: '1px solid #3f3f46'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <strong style={{ fontSize: '14px', fontWeight: 600 }}>Update Available</strong>
        <span style={{ fontSize: '12px', color: '#a1a1aa' }}>A new version of P2Pear is ready.</span>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => updateServiceWorker(true)}
          style={{
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
        <button 
          onClick={close}
          style={{
            backgroundColor: 'transparent',
            color: '#a1a1aa',
            border: '1px solid #3f3f46',
            padding: '6px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
