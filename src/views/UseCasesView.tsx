import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Zap, Globe, Lock, Cpu, ServerOff, Infinity as InfinityIcon } from 'lucide-react';

export const UseCasesView: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const cases = [
    {
      icon: <Globe size={24} className="accent" />,
      title: "The Universal AirDrop",
      description: "Apple's AirDrop is incredible, but it only works within the Apple ecosystem. Android's Quick Share only works between Androids and some PCs. P2Pear fixes this.",
      points: [
        "No cables or apps required.",
        "Transfer from iPhone to Windows, or Android to Mac.",
        "Transfers directly over the local network at blazing-fast Wi-Fi speeds."
      ]
    },
    {
      icon: <InfinityIcon size={24} className="accent" />,
      title: "Professional Media Production",
      description: "Media professionals deal with massive file sizes. A single 4K video shoot or an uncompressed multi-track audio session can easily exceed 50GB.",
      points: [
        "Zero limits: If your hard drive can hold it, P2Pear can send it.",
        "No 'Double Waiting': Skip the 2-hour upload and 2-hour download cycle. Transfers go directly from Person A to Person B simultaneously."
      ]
    },
    {
      icon: <ShieldAlert size={24} className="accent" />,
      title: "High-Security Corporate & Legal Data",
      description: "Law firms, medical institutions, and financial analysts routinely handle highly sensitive data subject to strict compliance laws (HIPAA, GDPR, NDAs).",
      points: [
        "Zero Server Storage: Files never touch a third-party server. No central database to be hacked or subpoenaed.",
        "Military-Grade E2EE: Data is encrypted on the sender's device and decrypted only on the receiver's device."
      ]
    },
    {
      icon: <Lock size={24} className="accent" />,
      title: "Journalism & Whistleblowing",
      description: "For investigative journalists, protecting sources and preventing data interception is a matter of life and death.",
      points: [
        "Ephemeral Signaling: Once connected, devices drop off the signaling server. The data channel is purely peer-to-peer.",
        "Absolute Anonymity: No email, no phone number, and no account creation. No metadata trail."
      ]
    },
    {
      icon: <Cpu size={24} className="accent" />,
      title: "Software Development & IT",
      description: "Developers frequently need to share massive, deeply-nested folders that are tedious to zip and upload.",
      points: [
        "Speed: Sending files across a corporate LAN via P2Pear is nearly instantaneous.",
        "Frictionless: Just drop the file in the browser. No AWS S3 buckets or pre-signed URLs required."
      ]
    },
    {
      icon: <ServerOff size={24} className="accent" />,
      title: "Offline or Restricted Environments",
      description: "Sometimes, the internet is down, restricted, or extremely slow, but the local network (LAN) is perfectly fine.",
      points: [
        "Local Routing: If both devices are on the same local network, WebRTC automatically routes files over the local LAN at gigabit router speeds."
      ]
    }
  ];

  return (
    <div className="app-layout" style={{ height: 'auto', minHeight: '100vh' }}>
      <header className="app-header">
        <Link to="/" className="logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <img src="/favicon.png" alt="P2Pear" style={{ width: 36, height: 36 }} />
          <span className="logo-text">P2Pear</span>
        </Link>
      </header>

      <main className="app-main" style={{ justifyContent: 'flex-start', paddingTop: '4rem', paddingBottom: '4rem', overflow: 'visible' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1.5rem' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h1 className="title-gradient" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1.1, marginBottom: '1.5rem' }}>
              P2Pear Use Cases & Scenarios
            </h1>
            <p className="subtitle" style={{ fontSize: '1.125rem', maxWidth: '700px', margin: '0 auto' }}>
              P2Pear is not just another file-sharing tool; it is a fundamental shift in how data moves across the internet. Discover how serverless WebRTC solves problems that traditional cloud tools cannot.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
            {cases.map((useCase, index) => (
              <div key={index} className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                    {useCase.icon}
                  </div>
                  <h3 style={{ fontSize: '1.25rem', margin: 0 }}>{useCase.title}</h3>
                </div>
                <p style={{ color: '#a1a1aa', lineHeight: 1.6, margin: 0 }}>{useCase.description}</p>
                <ul style={{ color: '#e4e4e7', paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {useCase.points.map((point, idx) => (
                    <li key={idx} style={{ lineHeight: 1.5 }}>{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '3rem', textAlign: 'center', background: 'linear-gradient(180deg, rgba(24,24,27,0.5) 0%, rgba(9,9,11,1) 100%)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#fff' }}>Ready to go off-grid?</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '2rem', fontSize: '1.125rem' }}>
              Experience the true speed of limitless, serverless peer-to-peer sharing.
            </p>
            <Link to="/" className="btn btn-primary" style={{ display: 'inline-flex', padding: '1rem 2rem', fontSize: '1.125rem' }}>
              <Zap size={20} /> Open P2Pear Now
            </Link>
          </div>

        </div>
      </main>

      <footer style={{ padding: '2rem', textAlign: 'center', color: '#71717a', fontSize: '0.875rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p style={{ margin: '0 0 1rem 0' }}>© 2026 P2Pear</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <Link to="/snapdrop-alternative" style={{ color: 'inherit', textDecoration: 'none' }}>Snapdrop Alternative</Link>
          <Link to="/wetransfer-alternative" style={{ color: 'inherit', textDecoration: 'none' }}>WeTransfer Alternative</Link>
          <Link to="/sharedrop-alternative" style={{ color: 'inherit', textDecoration: 'none' }}>ShareDrop Alternative</Link>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <Link to="/use-cases" style={{ color: '#fff', textDecoration: 'none' }}>Use Cases</Link>
          <Link to="/about" style={{ color: 'inherit', textDecoration: 'none' }}>About</Link>
          <Link to="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link to="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
};
