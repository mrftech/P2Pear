import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Zap, Infinity as InfinityIcon, ArrowRight, Lock, Check, HelpCircle } from 'lucide-react';

interface SeoLandingViewProps {
  competitor: 'Snapdrop' | 'WeTransfer' | 'ShareDrop';
}

export const SeoLandingView: React.FC<SeoLandingViewProps> = ({ competitor }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [competitor]);

  const content = {
    Snapdrop: {
      heroTitle: "The Better Alternative to Snapdrop",
      heroSubtitle: "Snapdrop often fails if you are not on the exact same Wi-Fi. P2Pear fixes this. It connects your devices instantly, anywhere, with 100% secure encryption.",
      comparisonText: "Snapdrop is a great tool, but it has a big problem: it usually only works if both phones or computers are on the exact same Wi-Fi network. If one person is on cell data and the other is on Wi-Fi, it breaks. \n\nP2Pear is built differently. It uses modern technology to link your devices no matter what network you are on. It creates a direct, secret tunnel between you and your friend. It is faster, it works anywhere, and it keeps your files completely safe.",
      features: [
        "Works across different Wi-Fi and cell networks",
        "Locks your files with unbreakable secret codes",
        "Clean, dark mode design that is easy to use"
      ],
      faqs: [
        { q: "Does P2Pear work if we are not on the same Wi-Fi?", a: "Yes! P2Pear works across different networks. You can be on cell data and your friend can be on Wi-Fi, and it will still connect instantly." },
        { q: "Is P2Pear safer than Snapdrop?", a: "Yes. P2Pear locks every file with strong end-to-end encryption. No one else can see what you send." },
        { q: "Do I have to download an app?", a: "No. Just open the website on your phone or computer, and it works right in your browser." }
      ]
    },
    WeTransfer: {
      heroTitle: "Why Pay for WeTransfer? Send Huge Files Free",
      heroSubtitle: "WeTransfer makes you wait to upload files, and limits you to 2GB. P2Pear sends files straight to your friend with absolutely zero size limits.",
      comparisonText: "When you use WeTransfer, you have to wait for your file to upload to their server. Then, your friend has to wait to download it. Plus, if your file is bigger than 2GB, they ask you to pay money!\n\nP2Pear skips the server completely. When you send a file, it goes directly from your phone straight into your friend's phone. Because there is no middle-man server holding your files, there are no file size limits. You can send a 50GB video for free, instantly.",
      features: [
        "No 2GB limit - send massive files instantly",
        "Files never sit on a server waiting to be hacked",
        "No email addresses or accounts needed"
      ],
      faqs: [
        { q: "What is the maximum file size I can send?", a: "There is no limit! Because the file goes directly between devices, you can send files as big as your hard drive can hold." },
        { q: "Does P2Pear store my files?", a: "No. Your files are never stored on any server. They go straight from you to your friend." },
        { q: "Is P2Pear totally free?", a: "Yes. P2Pear is 100% free with no premium upgrades needed to send large files." }
      ]
    },
    ShareDrop: {
      heroTitle: "The Modern Alternative to ShareDrop",
      heroSubtitle: "P2Pear brings a beautiful design, faster connections, and unbreakable encryption to peer-to-peer browser sharing.",
      comparisonText: "ShareDrop is a classic tool, but the web has grown up. Sometimes ShareDrop connections drop out, and the design feels a bit old. \n\nP2Pear was built in 2026 using the newest WebRTC code. This means it connects faster and stays connected. It also features a beautiful dark-mode interface and uses military-grade encryption to lock your files while they travel through the air.",
      features: [
        "Faster, more stable WebRTC connections",
        "Beautiful, modern dark-mode interface",
        "100% Free and open source-friendly"
      ],
      faqs: [
        { q: "How is P2Pear different from ShareDrop?", a: "P2Pear uses updated technology for stronger, faster connections, and features a modern, easy-to-use design." },
        { q: "Do my files touch a server?", a: "No. Just like ShareDrop, P2Pear is completely serverless. Files move device-to-device." },
        { q: "Can I use it on an iPhone?", a: "Yes! P2Pear works on any browser: iPhone, Android, Mac, or Windows." }
      ]
    }
  }[competitor];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": content.faqs.map(faq => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.a
      }
    }))
  };

  return (
    <div className="app-layout" style={{ height: 'auto', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      
      <header className="app-header">
        <Link to="/" className="logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <img src="/favicon.png" alt="P2Pear" style={{ width: 36, height: 36 }} />
          <span className="logo-text">P2Pear</span>
        </Link>
      </header>

      <main className="app-main" style={{ justifyContent: 'flex-start', paddingTop: '4rem', paddingBottom: '4rem', overflow: 'visible' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', padding: '0 1.5rem' }}>
          
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '100px', marginBottom: '2rem', color: '#a1a1aa', fontSize: '0.875rem' }}>
            <Lock size={14} /> End-to-end encrypted
          </div>
          
          <h1 className="title-gradient" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1.1, marginBottom: '1.5rem' }}>
            {content.heroTitle}
          </h1>
          
          <p className="subtitle" style={{ fontSize: '1.125rem', marginBottom: '3rem', maxWidth: '600px', margin: '0 auto' }}>
            {content.heroSubtitle}
          </p>

          <Link to="/" className="btn btn-primary" style={{ display: 'inline-flex', padding: '1rem 2rem', fontSize: '1.125rem', marginBottom: '4rem' }}>
            Start Sharing Now <ArrowRight size={20} />
          </Link>

          {/* New Detailed Comparison Section */}
          <div className="glass-panel" style={{ textAlign: 'left', marginBottom: '4rem', padding: '2.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem', marginTop: 0 }}>The Difference</h2>
            {content.comparisonText.split('\n\n').map((paragraph, idx) => (
              <p key={idx} style={{ color: '#e4e4e7', fontSize: '1.125rem', lineHeight: 1.8, marginBottom: '1.5rem' }}>
                {paragraph}
              </p>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', textAlign: 'left', marginBottom: '4rem' }}>
            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Shield className="text-cyan" size={32} />
              <h3 style={{ fontSize: '1.25rem', margin: 0 }}>100% Private</h3>
              <p style={{ color: '#a1a1aa', margin: 0, lineHeight: 1.6 }}>Files travel directly from your device to theirs. No servers in the middle storing your data.</p>
            </div>
            
            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <InfinityIcon className="text-purple" size={32} />
              <h3 style={{ fontSize: '1.25rem', margin: 0 }}>No Limits</h3>
              <p style={{ color: '#a1a1aa', margin: 0, lineHeight: 1.6 }}>Send a 10MB photo or a 100GB video. Because there are no servers, there are no artificial file size caps.</p>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Zap className="text-cyan" size={32} />
              <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Lightning Fast</h3>
              <p style={{ color: '#a1a1aa', margin: 0, lineHeight: 1.6 }}>Your devices connect over the shortest possible path, maximizing your download speed.</p>
            </div>
          </div>

          <div className="glass-panel" style={{ textAlign: 'left', marginBottom: '4rem', padding: '2.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', marginTop: 0 }}>Why P2Pear beats {competitor}</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {content.features.map((feature, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', color: '#e4e4e7', fontSize: '1.125rem' }}>
                  <Check className="text-cyan" size={24} style={{ flexShrink: 0 }} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* New FAQ Section */}
          <div style={{ textAlign: 'left', marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '2rem', textAlign: 'center' }}>Frequently Asked Questions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {content.faqs.map((faq, i) => (
                <div key={i} className="glass-panel" style={{ padding: '2rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <HelpCircle className="text-purple" size={24} />
                    {faq.q}
                  </h3>
                  <p style={{ color: '#a1a1aa', margin: 0, lineHeight: 1.6, paddingLeft: '2.25rem' }}>
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};
