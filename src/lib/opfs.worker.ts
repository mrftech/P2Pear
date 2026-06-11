// opfs.worker.ts
// A dedicated Web Worker for performing high-performance synchronous writes
// to the Origin Private File System (OPFS). This is required for Firefox and
// Safari, which block OPFS write operations on the Main Thread.

// Define types for messages
export type WorkerMessage = 
  | { type: 'init'; fileId: string; name: string }
  | { type: 'write'; fileId: string; chunk: Uint8Array }
  | { type: 'close'; fileId: string };

export type WorkerResponse = 
  | { type: 'init-success'; fileId: string }
  | { type: 'init-error'; fileId: string; error: string }
  | { type: 'write-success'; fileId: string }
  | { type: 'write-error'; fileId: string; error: string }
  | { type: 'close-success'; fileId: string }
  | { type: 'close-error'; fileId: string; error: string };

const handles: Map<string, any> = new Map();

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  try {
    if (msg.type === 'init') {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(`swarmgrid-${msg.fileId}`, { create: true });
      
      // Use createSyncAccessHandle for high performance synchronous writes
      // This is widely supported in Web Workers across all modern browsers
      // (unlike createWritable which is blocked in Firefox/Safari workers)
      const accessHandle = await (fileHandle as any).createSyncAccessHandle();
      handles.set(msg.fileId, accessHandle);
      
      self.postMessage({ type: 'init-success', fileId: msg.fileId } as WorkerResponse);
    } 
    else if (msg.type === 'write') {
      const handle = handles.get(msg.fileId);
      if (!handle) throw new Error("File handle not found or closed.");
      
      // write is synchronous, returns number of bytes written
      handle.write(msg.chunk);
      // Wait, in some older specs flush() is required, but usually close() flushes
      
      // Don't send success for every chunk to avoid IPC overhead,
      // the caller handles flow control via the main thread's logic.
    } 
    else if (msg.type === 'close') {
      const handle = handles.get(msg.fileId);
      if (handle) {
        // flush ensures data is physically written before closing
        if (typeof handle.flush === 'function') {
            handle.flush();
        }
        handle.close();
        handles.delete(msg.fileId);
      }
      self.postMessage({ type: 'close-success', fileId: msg.fileId } as WorkerResponse);
    }
  } catch (error: any) {
    console.error("[OPFS Worker Error]", error);
    if (msg.type === 'init') {
      self.postMessage({ type: 'init-error', fileId: msg.fileId, error: error.message || String(error) } as WorkerResponse);
    } else if (msg.type === 'write') {
      self.postMessage({ type: 'write-error', fileId: msg.fileId, error: error.message || String(error) } as WorkerResponse);
    } else if (msg.type === 'close') {
      self.postMessage({ type: 'close-error', fileId: msg.fileId, error: error.message || String(error) } as WorkerResponse);
    }
  }
};
