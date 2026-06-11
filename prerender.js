import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('index.html not found. Build must have failed.');
  process.exit(1);
}

const template = fs.readFileSync(indexPath, 'utf-8');

const pages = [
  {
    path: 'snapdrop-alternative',
    title: 'P2Pear | The Best Snapdrop Alternative in 2026',
    description: 'Looking for a Snapdrop alternative? P2Pear offers 100% secure, end-to-end encrypted, limitless peer-to-peer file sharing directly from your browser. No server storage.',
    keywords: 'snapdrop alternative, share files like snapdrop, snapdrop vs p2pear, secure snapdrop'
  },
  {
    path: 'wetransfer-alternative',
    title: 'P2Pear | The Free WeTransfer Alternative (No Size Limits)',
    description: 'Why pay for WeTransfer? P2Pear lets you send massive files instantly between any devices with absolutely zero size limits. 100% free and serverless.',
    keywords: 'wetransfer alternative, send large files free, no size limit file transfer, wetransfer vs p2pear'
  },
  {
    path: 'sharedrop-alternative',
    title: 'P2Pear | The Secure ShareDrop Alternative',
    description: 'A modern, end-to-end encrypted alternative to ShareDrop. Transfer files instantly across any network without size limits.',
    keywords: 'sharedrop alternative, p2p file transfer, secure airdrop alternative'
  }
];

// Helper to replace meta tags
function replaceMeta(html, tagType, propertyName, propertyValue, newValue) {
  // Regex to match <meta name="title" content="..."> or <meta property="og:title" content="...">
  // It handles double or single quotes, and various ordering of attributes.
  const regex = new RegExp(`(<meta\\s+(?:name|property)=["']${propertyName}["']\\s+content=["'])([^"']*)(["']\\s*\/?>)`, 'gi');
  
  if (tagType === 'title') {
    html = html.replace(/<title>.*?<\/title>/i, `<title>${newValue}</title>`);
  }
  
  return html.replace(regex, `$1${newValue}$3`);
}

pages.forEach(page => {
  let html = template;
  
  // Replace standard tags
  html = replaceMeta(html, 'title', 'title', '', page.title);
  html = replaceMeta(html, 'meta', 'description', '', page.description);
  html = replaceMeta(html, 'meta', 'keywords', '', page.keywords);
  
  // Replace OG tags
  html = replaceMeta(html, 'meta', 'og:title', '', page.title);
  html = replaceMeta(html, 'meta', 'og:description', '', page.description);
  
  // Replace Twitter tags
  html = replaceMeta(html, 'meta', 'twitter:title', '', page.title);
  html = replaceMeta(html, 'meta', 'twitter:description', '', page.description);

  // Update JSON-LD WebApplication schema description and name
  html = html.replace(
    /"description":\s*"[^"]*"/,
    `"description": "${page.description}"`
  );

  const routeDir = path.join(distDir, page.path);
  if (!fs.existsSync(routeDir)) {
    fs.mkdirSync(routeDir, { recursive: true });
  }

  fs.writeFileSync(path.join(routeDir, 'index.html'), html);
  console.log(`Pre-rendered: /${page.path}`);
});

console.log('✅ Pre-rendering complete!');
