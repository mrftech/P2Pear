# P2Pear: Future Signaling Server Roadmap

This document outlines the architectural roadmap for transitioning P2Pear from a 100% manual "Serverless" WebRTC connection model to a "1-Click" automatic Signaling Server model using Cloudflare Workers and WebSockets.

## 1. Why Transition?
Currently, P2Pear is completely serverless. The tradeoff is that users must manually exchange WebRTC Offer/Answer codes (Step 1 & Step 2). 
Implementing a signaling server allows for a **1-click connection UX**: 
Peer A shares a short link, Peer B clicks it, and they are instantly connected. 

## 2. Technical Architecture

### Infrastructure
- **Hosting:** Cloudflare Workers (already in use for static hosting).
- **State Management:** Cloudflare Durable Objects or Workers KV to manage isolated "Rooms".
- **Communication:** WebSockets for real-time, low-latency signaling between the browser and the Worker.

### Connection Flow (The "1-Click" Magic)
1. **Peer A** clicks "Start Session". 
2. Peer A connects to the Cloudflare Worker via WebSocket and requests a new Room ID.
3. The Worker creates a short URL (e.g., `p2pear.com/join/7382`) and gives it to Peer A.
4. Peer A sends this link to Peer B.
5. **Peer B** opens the link and connects to the same Room ID via WebSocket.
6. Peer A's browser automatically generates the WebRTC **Offer** and sends it through the WebSocket to Peer B.
7. Peer B's browser automatically generates the WebRTC **Answer** and sends it through the WebSocket to Peer A.
8. The P2P connection is established. **The WebSocket can now be safely disconnected.** All file and chat data flows directly between the peers.

## 3. Implementation Phases

### Phase 1: Backend Setup (Cloudflare Worker)
- [ ] Initialize a new Cloudflare Worker environment specifically for WebSockets.
- [ ] Implement a `RoomManager` (using Durable Objects for strong consistency, or KV for simpler setups).
- [ ] Define WebSocket event types: `join-room`, `webrtc-offer`, `webrtc-answer`, `webrtc-ice-candidate`, `peer-left`.

### Phase 2: Frontend Refactor
- [ ] Update `src/lib/webrtc.ts` to support an optional `SignalingClient`.
- [ ] Create `src/lib/signaling.ts` to manage the WebSocket connection to the Cloudflare Worker.
- [ ] Refactor the UI in `ConnectionManager.tsx` to replace "Step 2: Paste Code" with a simple "Waiting for peer to click link..." spinner.

### Phase 3: Edge Cases & Security
- [ ] Implement ICE Candidate trickling (sending candidates one-by-one via WebSocket for faster connections).
- [ ] Add Room passwords or PINs (optional) to prevent strangers from guessing the 4-digit room code.
- [ ] Ensure the signaling server logs absolutely no metadata (zero-knowledge routing).
- [ ] Implement auto-reconnection logic if the signaling WebSocket drops before the WebRTC connection is finalized.

## 4. Privacy Considerations
Even with a signaling server, P2Pear remains **End-to-End Encrypted**. The signaling server only routes the IP addresses and cryptographic fingerprints needed to establish the WebRTC connection. Once connected, the server is removed from the loop, and all files/messages are encrypted via AES-GCM and sent directly over the P2P DataChannel.



----------


# P2Pear Architecture Roadmap
## Option 2: The "Serverless" Temporary KV (Cloudflare)
**Goal:** Provide extremely short, beautiful connection URLs (e.g., `p2pear.com/#A1B2C3`) and eliminate the manual "copy-paste answer" step, creating a seamless 1-click connection experience.
### Architecture
Since the site is already hosted on Cloudflare Workers, we have access to a globally distributed database called Cloudflare KV (Key-Value storage) for free. It is "serverless" in the sense that we don't rent or maintain a specific server instance, but it acts as a lightweight signaling backend. We can tweak the Cloudflare Worker to act as a 5-minute clipboard for the WebRTC handshakes.
### Workflow
1. User A clicks "Create Link".
2. The App securely encrypts the massive WebRTC payload and sends it to Cloudflare KV, receiving a 6-digit PIN in return.
3. The connection URL becomes `p2pear.com/#A1B2C3`.
4. User B opens the link, grabs the encrypted payload from KV, and generates an "Answer".
5. User B uploads the "Answer" to KV.
6. User A's browser polls KV (or uses WebSockets), picks up the Answer, and the direct P2P connection is instantly established.
7. KV automatically deletes all signaling data after 5 minutes.
### Financial Forecast (2026 Cloudflare Limits)
*   **Startup Scale (Up to 15,000 connections/month):** $0.00
*   **Growing Scale (Up to 500,000 connections/month):** $5.00 flat fee (Workers Paid Plan)
*   **Viral Scale (1,000,000 connections/month):** $5.55 ($0.50 per extra million writes)
*   **WeTransfer Scale (10,000,000 connections/month):** ~$10.50
### Pros & Cons
*   **Pros:** Perfect user experience. The URL is tiny. Connection is fully automated with no manual copy-pasting. Still perfectly end-to-end encrypted (KV only stores encrypted blobs).
*   **Cons:** Relies on Cloudflare KV. The payload touches a network briefly during the signaling phase.
*Currently deferred in favor of Option 1 (Aggressive Client-Side SDP Minification) to maintain a strictly 0-network-storage guarantee.*
