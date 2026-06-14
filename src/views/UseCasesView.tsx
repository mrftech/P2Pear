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
      title: "Share Between Any Phone or PC",
      description: "Apple's AirDrop is great, but it only works on Apple devices. What if your friend has an Android and you have an iPhone? P2Pear fixes this.",
      points: [
        "Send files from an iPhone to a Windows PC, or Android to a Mac.",
        "No cables to plug in.",
        "No apps to download or install."
      ]
    },
    {
      icon: <InfinityIcon size={24} className="accent" />,
      title: "Send Huge Videos Instantly",
      description: "Are you trying to send a massive 50GB home video or a giant folder of photos? Most apps stop you at 2GB.",
      points: [
        "Zero limits: If your phone or computer has the space, you can send it.",
        "No double waiting: You don't have to wait hours to upload it to the cloud while your friend waits to download it. It goes straight to them at the same time."
      ]
    },
    {
      icon: <ShieldAlert size={24} className="accent" />,
      title: "Keep Private Files Safe",
      description: "Sometimes you need to send highly private documents like tax returns, legal papers, or doctor records.",
      points: [
        "No servers: Your files never sit on a cloud server waiting to be hacked.",
        "Locked tight: Everything is locked with a secret code on your device, and only your friend's device can unlock it."
      ]
    },
    {
      icon: <Lock size={24} className="accent" />,
      title: "Share Without Leaving a Trace",
      description: "If you want to share something without anyone knowing who you are, most apps require an email or phone number.",
      points: [
        "No accounts needed: We never ask for your name, email, or password.",
        "Leaves no trace: Once you close the page, the connection is gone forever and leaves zero records behind."
      ]
    },
    {
      icon: <Cpu size={24} className="accent" />,
      title: "Send Giant Work Folders",
      description: "If you work on computers, you know how annoying it is to zip up thousands of files just to send them to a coworker.",
      points: [
        "Send whole folders: Just drop the folder right into the browser.",
        "Super fast: If you are in the same office, it sends almost instantly over the local network."
      ]
    },
    {
      icon: <ServerOff size={24} className="accent" />,
      title: "Works With Bad Internet",
      description: "What if you are at an event with terrible cell service, but you want to send a video to someone standing next to you?",
      points: [
        "Skips the internet: If you are both on the same Wi-Fi router, the files fly through the air between your phones.",
        "Super fast speeds: It works incredibly fast even if the outside internet is broken or slow."
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
              How to Use P2Pear
            </h1>
            <p className="subtitle" style={{ fontSize: '1.125rem', maxWidth: '700px', margin: '0 auto' }}>
              P2Pear is the easiest way to move files across the internet. By skipping the cloud and sending files directly between devices, it solves everyday problems that regular apps cannot.
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
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#fff' }}>Ready to try it out?</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '2rem', fontSize: '1.125rem' }}>
              Experience the fastest and easiest way to share files with your friends.
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
