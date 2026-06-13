# Signaling Architecture Changelog

## Current State: Decentralized Nostr Relays (via Trystero)
As of the latest update, P2Pear uses **Trystero v0.25** for WebRTC signaling.
- **How it works:** Instead of compressing the connection data into a massive URL, the app generates a 6-character room code (e.g., `#A1B2C3`). It connects to 5+ public Nostr Relays (decentralized social servers) simultaneously to broadcast the WebRTC offer/answer behind the scenes.
- **Reliability:** **High, but with caveats.** Because it connects to multiple servers at once, it is highly resilient to single-server failures. If one server rate-limits you (e.g., `relay.damus.io`), the other 4 servers ensure the connection still succeeds. However, because you do not own these servers, there is a small risk that multiple servers go offline or block your traffic simultaneously.

## Previous State: 100% Serverless URL Hashes
The original architecture relied strictly on compressing the WebRTC SDP payload and embedding it entirely in the URL hash.
- **How it works:** The app generates a ~1000 character compressed Base64 string and requires the user to manually copy-paste the "Answer" string back to the creator.
- **Reliability:** **Absolute (100%).** Because it uses zero network infrastructure for signaling, it cannot be rate-limited, blocked by firewalls, or taken offline. 

---

## How to Swap Back to the Original State
If you ever find that the Nostr relays become too unreliable, or you want to return to the uncompromising 100% serverless approach, you have two ways to revert:

### Option 1: Using Git (Fastest)
Since your project uses Git, you can simply view your commit history and revert the repository back to the state before Trystero was installed.
```bash
# View the commit history to find the commit before the Trystero update
git log

# Revert to a specific commit hash
git checkout <commit-hash>
```

### Option 2: Manual Code Swap
If you want to manually revert the code, you need to undo the changes made to two files.

**1. `src/lib/webrtc.ts`**
Remove the `SignalingManager` class at the bottom of the file, and remove the `import { joinRoom, type Room } from 'trystero'` import at the top. The `WebRTCManager` class remains unchanged, as it still handles the actual P2P file transfers.

**2. `src/components/ConnectionManager.tsx`**
Revert the UI back to the 2-step manual copy-paste workflow. 
* *Step 1:* User clicks "Create Link", which calls `rtcManager.generateOffer()` and sets the output as the URL hash.
* *Step 2:* The second user opens the link, which calls `rtcManager.handleOffer(hash)` and generates an Answer string. They manually copy-paste this Answer string back to the first user, who calls `rtcManager.handleAnswer(answer)`.

**3. Dependencies**
Remove Trystero from the project:
```bash
pnpm remove trystero
```
