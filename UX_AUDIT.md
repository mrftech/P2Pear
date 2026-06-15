# Critical UX Issues Audit

> Generated: 2026-06-14
> Scope: Full user journey review of P2Pear (landing, connection, file share, chat)

---

## 1. No "Cancel" button while joining (High)

**Problem:**
You added Cancel for the creator, but the **joiner is trapped** for 45 seconds with no escape. If they pasted the wrong code, they must wait or refresh.

**Affected file:**
`src/components/ConnectionManager.tsx` (joining state block)

**Fix:**
Add a Cancel button in the `joining` state identical to the `creating` one.

```tsx
<button className="btn" style={{ marginTop: '1rem', color: 'var(--text-secondary)' }} onClick={() => { setMode('idle'); if (sigManagerRef.current) sigManagerRef.current.leave(); }}>
  Cancel
</button>
```

**Effort:** 5 min

---

## 2. Connection drop = scary error wall (High)

**Problem:**
When the peer disconnects (closes tab, network blip), the user sees a red `alert-danger` banner saying "Connection failed" or "Connection closed". There is **no "Reconnect" or "Start over" button** — just a dead app.

**Affected files:**
- `src/App.tsx` (error state handling)
- `src/components/ConnectionManager.tsx` (error display)

**Fix:**
In `App.tsx`, when `status === 'error'`, show a clear recovery CTA: "Create new room" or "Try again" that resets state.

**Effort:** 10 min

---

## 3. File download failures use `alert()` (Medium)

**Problem:**
`FileShare.tsx` line 231: `alert('Download failed: ' + reason)`. Native alerts break the flow on mobile and look unprofessional.

**Affected file:**
`src/components/FileShare.tsx`

**Fix:**
Replace with an inline toast or banner inside the file list.

**Effort:** 15 min

---

## 4. No visual feedback when sending a chat message fails (Medium)

**Problem:**
`Chat.tsx` line 35-38: if `rtcManager.sendChat()` throws, the error is only `console.error`. The user sees nothing — their message appears to vanish.

**Affected file:**
`src/components/Chat.tsx`

**Fix:**
Show a red retry indicator or shake animation on the input.

**Effort:** 10 min

---

## 5. "Delete everything & exit" is the only way out (Medium-High)

**Problem:**
Once connected, the only way to end is a destructive red button. Users may want to **gracefully disconnect** without wiping history (e.g., to reconnect later).

**Affected file:**
`src/App.tsx`

**Fix:**
Add a secondary "Disconnect" option that keeps data, alongside the destructive "Delete everything".

**Effort:** 15 min

---

## 6. No file preview for images (Medium)

**Problem:**
Users must download every file to see it. For images, a thumbnail preview would save taps.

**Affected file:**
`src/components/FileShare.tsx`

**Fix:**
If `mimeType.startsWith('image/')`, render an `<img>` thumbnail using `URL.createObjectURL(blob)`.

**Effort:** 20 min

---

## 7. Chat input lacks auto-focus on open (Low)

**Problem:**
Opening the chat drawer on mobile requires an extra tap into the input field.

**Affected file:**
`src/components/Chat.tsx`

**Fix:**
`useEffect` with `inputRef.current?.focus()` when drawer opens.

**Effort:** 2 min

---

## 8. Join input doesn't auto-focus on paste (Low)

**Problem:**
When a user lands with a magic link, the app auto-joins. But if they manually paste a code, the input doesn't focus.

**Affected file:**
`src/components/ConnectionManager.tsx`

**Fix:**
Already works with the inline input, but the paste-to-auto-extract logic could be smoother.

**Effort:** 5 min

---

## 9. No "Copied!" toast for the room code (Low)

**Problem:**
The copy hint works on desktop hover, but on mobile there is no hover. Users tap and get no immediate feedback.

**Affected file:**
`src/components/ConnectionManager.tsx`

**Fix:**
Already partially there with `copiedLink` state, but the hint may be off-screen on small devices. Consider a centered toast.

**Effort:** 10 min

---

## 10. Progress bars disappear too fast (Low)

**Problem:**
File progress clears after 3 seconds. For large files, the user may miss the completion state.

**Affected file:**
`src/components/FileShare.tsx`

**Fix:**
Keep the completed item visible with a checkmark for a few more seconds, or animate the transition.

**Effort:** 10 min

---

## Summary: Top 3 to fix

| Priority | Issue | Effort |
|----------|-------|--------|
| 🔴 High | Cancel button for joining state | 5 min |
| 🔴 High | Recovery CTA on connection error | 10 min |
| 🟡 Medium | Replace `alert()` with inline error | 15 min |
