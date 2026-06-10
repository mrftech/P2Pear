import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Info, FileText } from 'lucide-react';
import '../index.css';

interface LegalViewProps {
  page: 'about' | 'privacy' | 'terms';
}

export const LegalView: React.FC<LegalViewProps> = ({ page }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  const content = {
    about: {
      title: 'About P2Pear',
      icon: <Info className="text-zinc-500" size={32} />,
      body: (
        <>
          <p>
            P2Pear was built with a single mission: to provide the fastest, most secure way to share files and communicate across devices without relying on third-party servers.
          </p>
          <h3>How it Works</h3>
          <p>
            Traditional file sharing services require you to upload your personal files to their servers, where they wait for the recipient to download them. This means your data is temporarily stored on someone else's computer.
          </p>
          <p>
            P2Pear uses <strong>WebRTC</strong> (Web Real-Time Communication). When you connect with someone, your browser establishes a direct, encrypted tunnel to their browser. Files and chat messages are streamed directly through this tunnel. 
          </p>
          <h3>100% Serverless</h3>
          <p>
            Because the connection is direct, P2Pear requires zero backend infrastructure to move your files. We only provide the open-source client application that facilitates the connection.
          </p>
        </>
      ),
    },
    privacy: {
      title: 'Privacy Policy',
      icon: <ShieldAlert className="color-success" size={32} />,
      body: (
        <>
          <p><strong>Last Updated: June 2026</strong></p>
          <p>
            At P2Pear, privacy isn't just a promise—it's a technical guarantee. Because our application is entirely serverless, we simply do not have the capability to collect, store, or intercept your data.
          </p>
          <h3>Data Collection</h3>
          <p>
            <strong>We do not collect any personal data.</strong> We do not use tracking cookies, analytics scripts, or user accounts. 
          </p>
          <h3>File and Message Privacy</h3>
          <p>
            All file transfers and chat messages are transmitted directly between peers using end-to-end encrypted WebRTC data channels. Your files never pass through or rest on our servers. 
          </p>
          <h3>Local Storage</h3>
          <p>
            P2Pear uses your device's local IndexedDB to temporarily buffer large files during transfer. Once you close the application or click "Delete everything & exit", this local data is permanently wiped from your device.
          </p>
        </>
      ),
    },
    terms: {
      title: 'Terms of Service',
      icon: <FileText className="text-zinc-500" size={32} />,
      body: (
        <>
          <p><strong>Last Updated: June 2026</strong></p>
          <h3>Acceptance of Terms</h3>
          <p>
            By accessing and using P2Pear, you accept and agree to be bound by the terms and provision of this agreement. 
          </p>
          <h3>User Responsibility</h3>
          <p>
            P2Pear is a direct peer-to-peer connection tool. You are entirely responsible for the files you choose to transfer and the messages you send. P2Pear does not monitor, filter, or control the content transmitted through its protocol. You agree not to use this service to transmit malicious software or illegal content.
          </p>
          <h3>Disclaimer of Warranties</h3>
          <p>
            This service is provided "as is" and "as available". P2Pear makes no warranties, expressed or implied, and hereby disclaims all warranties, including without limitation, implied warranties of merchantability or fitness for a particular purpose.
          </p>
          <h3>Limitation of Liability</h3>
          <p>
            In no event shall P2Pear or its contributors be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the P2Pear application.
          </p>
        </>
      ),
    },
  };

  const { title, icon, body } = content[page];

  return (
    <div className="app-layout">
      <header className="app-header">
        <Link to="/" className="logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <img src="/favicon.svg" alt="P2Pear" style={{ width: 24, height: 24 }} />
          <span className="logo-text">P2Pear</span>
        </Link>
        <Link to="/" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <ArrowLeft size={18} /> Back to Home
        </Link>
      </header>
      
      <main className="app-main" style={{ justifyContent: 'flex-start', paddingTop: '2rem' }}>
        <div className="glass-panel" style={{ maxWidth: '800px', width: '100%', margin: '0 auto', textAlign: 'left', padding: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            {icon}
            <h1 className="title-gradient" style={{ margin: 0, fontSize: '2rem' }}>{title}</h1>
          </div>
          <div className="legal-content" style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            {body}
          </div>
        </div>
      </main>
    </div>
  );
};
