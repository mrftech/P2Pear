<div align="center">
  <img src="public/icon-512x512.png" alt="P2Pear Logo" width="120" height="120" />

  # P2Pear

  **100% Serverless, End-to-End Encrypted Peer-to-Peer File Sharing & Chat**

  [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
  [![Vite](https://img.shields.io/badge/Vite-B73BFE?logo=vite&logoColor=white)](#)
  [![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](#)
</div>

<br />

## 🌟 What is P2Pear?

P2Pear is an open-source, ultra-secure communication tool that allows two users to connect directly to each other via WebRTC. It features zero server infrastructure, ensuring your data never touches a middleman. 

Share unlimited files, chat in real-time, and leave zero traces behind.

## ✨ Features

- 🔐 **End-to-End Encrypted**: Data travels directly between peers using secure WebRTC data channels. Signaling is routed through public Nostr relays and protected with military-grade PBKDF2 WebCrypto AES-GCM encryption.
- 🚫 **100% Serverless Backend**: No centralized backend, no databases, no central authority. We use decentralized relays for signaling, so no proprietary servers are required.
- ⚡ **Instant Transfer**: Files are streamed directly device-to-device.
- 🧹 **Zero Traces**: Once you close the app, everything is permanently wiped from device memory.

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Bundler**: [Vite](https://vitejs.dev/)
- **Core Library**: Native WebRTC APIs (`RTCPeerConnection`)
- **Database**: `idb` (IndexedDB for temporary file chunking)

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18+) and [pnpm](https://pnpm.io/) installed.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mrftech/P2Pear.git
   cd P2Pear
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Start the development server:**
   ```bash
   pnpm run dev
   ```

4. Open `http://localhost:5173` in your browser.

## 🤝 Contributing

We welcome contributions of all sizes! Whether you are fixing a bug, adding a feature, or improving documentation, we'd love to see your pull requests.

Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting your work.

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
