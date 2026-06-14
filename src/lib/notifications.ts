export function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(e => console.error("Failed to request notification permission", e));
  }
}

export function playMessageChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = 'sine';
    // Soft high pitch (Note A5)
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    
    // Quick pop/ding envelope
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.warn("Failed to play audio chime", e);
  }
}

export function showSystemNotification(body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification("P2Pear", { body });
    } catch (e) {
      console.warn("Failed to show notification", e);
    }
  }
}
