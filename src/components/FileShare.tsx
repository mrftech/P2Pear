import React, { useState, useEffect, useRef } from 'react';
import { WebRTCManager } from '../lib/webrtc';
import { getFiles, type SharedFile } from '../lib/db';
import { UploadCloud, File as FileIcon, Download, CheckCircle2, Share2, Loader2, Image as ImageIcon, Film, FileText, FileArchive, FileCode, FileAudio, X } from 'lucide-react';

interface FileShareProps {
  rtcManager: WebRTCManager;
  refreshTrigger: number;
  status?: string;
}

export const FileShare: React.FC<FileShareProps> = ({ rtcManager, refreshTrigger, status }) => {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [progresses, setProgresses] = useState<{
    [fileId: string]: { name: string, bytes: number, total: number, type: 'upload' | 'download' }
  }>({});
  const [queue, setQueue] = useState<{ id: string; file: File }[]>([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    rtcManager.onProgress = (fileId, name, bytes, total, type) => {
      setProgresses(prev => ({
        ...prev,
        [fileId]: { name, bytes, total, type }
      }));
      
      // Clean up when complete
      if (bytes >= total) {
        setTimeout(() => {
          setProgresses(prev => {
            const next = {...prev};
            delete next[fileId];
            return next;
          });
        }, 3000);
      }
    };
    return () => { rtcManager.onProgress = undefined; };
  }, [rtcManager]);

  const loadFiles = async () => {
    const dbFiles = await getFiles();
    // Sort descending by timestamp
    setFiles(dbFiles.sort((a, b) => b.timestamp - a.timestamp));
  };

  useEffect(() => {
    loadFiles();
  }, [refreshTrigger]);



  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    const newQueueItems = Array.from(selectedFiles).map(file => ({
      id: crypto.randomUUID(),
      file
    }));
    setQueue(prev => [...prev, ...newQueueItems]);
  };

  useEffect(() => {
    if (isSending || queue.length === 0) return;

    const processQueue = async () => {
      setIsSending(true);
      const sortedQueue = [...queue].sort((a, b) => a.file.size - b.file.size);
      setQueue([]);

      for (const item of sortedQueue) {
        try {
          await rtcManager.sendFile(item.file);
        } catch (e) {
          console.error('Failed to send file:', e);
        }
      }
      setIsSending(false);
    };

    processQueue();
  }, [queue, isSending, rtcManager]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (mimeType: string) => {
    if (!mimeType) return FileIcon;
    const lower = mimeType.toLowerCase();
    if (lower.startsWith('image/')) return ImageIcon;
    if (lower.startsWith('video/')) return Film;
    if (lower.startsWith('audio/')) return FileAudio;
    if (lower.includes('pdf') || lower.includes('text/plain') || lower.includes('document')) return FileText;
    if (lower.includes('zip') || lower.includes('rar') || lower.includes('tar') || lower.includes('compressed')) return FileArchive;
    if (lower.includes('json') || lower.includes('javascript') || lower.includes('html') || lower.includes('xml')) return FileCode;
    return FileIcon;
  };

  const getDisplayFormat = (name: string, mimeType?: string) => {
    const parts = name.split('.');
    if (parts.length > 1) {
      const ext = parts.pop();
      if (ext && ext.length <= 4) return ext.toUpperCase();
    }
    if (mimeType) {
      const mime = mimeType.split('/')[1];
      if (mime) return mime.toUpperCase();
    }
    return 'FILE';
  };

  const getFilenameWithExtension = (name: string, type: string) => {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 
      'image/webp': '.webp', 'image/svg+xml': '.svg', 'video/mp4': '.mp4', 
      'video/webm': '.webm', 'video/x-matroska': '.mkv', 'audio/mpeg': '.mp3', 
      'audio/wav': '.wav', 'application/pdf': '.pdf', 'application/zip': '.zip', 
      'text/plain': '.txt', 'text/html': '.html', 'text/csv': '.csv', 
      'application/json': '.json'
    };
    
    const correctExt = mimeToExt[type.toLowerCase()];
    
    // If there's no dot, just append the correct extension
    if (!name.includes('.')) {
      return correctExt ? `${name}${correctExt}` : name;
    }

    // Check if the current extension got corrupted by OS duplication (e.g. "image.png(1)")
    const parts = name.split('.');
    const currentExt = parts[parts.length - 1].toLowerCase();
    
    if (correctExt && !currentExt.startsWith(correctExt.replace('.', ''))) {
      // The extension doesn't match the MIME type, or is completely corrupted
      // Remove trailing junk like "(1)" if it exists, and append correct ext
      const cleanName = name.replace(/\(\d+\)$/, '').trim();
      if (!cleanName.endsWith(correctExt)) {
         return `${cleanName}${correctExt}`;
      }
      return cleanName;
    }
    
    return name;
  };

  const handleDownload = async (file: SharedFile) => {
    try {
      setDownloadingId(file.id);
      // Give React a tick to render the loading spinner before blocking the main thread
      await new Promise(r => setTimeout(r, 50));

      let finalBlob: Blob | File | undefined = file.blob;

      if (file.fileHandle) {
        try {
          const handle = file.fileHandle as FileSystemFileHandle;
          const rawFile = await handle.getFile();
          // OPFS strips MIME types. Re-inject the original exact format type
          finalBlob = new Blob([rawFile], { type: file.type || '' });
          
          // Modern Chrome/Edge: Direct to disk with Save dialog
          if ('showSaveFilePicker' in window) {
            const finalName = getFilenameWithExtension(file.name, file.type);
            const extParts = finalName.split('.');
            const ext = extParts.length > 1 ? '.' + extParts.pop() : '';

            const pickerOptions: any = { suggestedName: finalName };
            
            // Force the Windows Save Dialog to enforce the extension
            if (file.type && file.type.includes('/') && ext) {
              pickerOptions.types = [{
                accept: { [file.type]: [ext] }
              }];
            }

            try {
              let saveHandle;
              try {
                saveHandle = await (window as any).showSaveFilePicker(pickerOptions);
              } catch (pickerErr: any) {
                if (pickerErr.name === 'AbortError') throw pickerErr;
                // If Chrome rejected the types array due to a strict MIME mismatch, fallback to raw name
                saveHandle = await (window as any).showSaveFilePicker({ suggestedName: finalName });
              }

              const writable = await saveHandle.createWritable();
              await writable.write(finalBlob);
              await writable.close();
              setDownloadingId(null);
              return; // Successfully saved via native API
            } catch (pickerErr: any) {
              if (pickerErr.name === 'AbortError') {
                setDownloadingId(null);
                return;
              }
              console.warn('[FileShare] showSaveFilePicker failed, falling back:', pickerErr);
            }
          }
        } catch (handleErr) {
          console.error('[FileShare] OPFS handle read failed, falling back to blob:', handleErr);
        }
      }

      if (!finalBlob || finalBlob.size === 0) {
        throw new Error(
          'File data is no longer available. It may have been cleared by another browser tab or session.'
        );
      }

      // Legacy fallback (Firefox/Safari)
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getFilenameWithExtension(file.name, file.type);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // The browser's native save happens asynchronously outside JS control.
      // We keep the spinner active for 2.5 seconds so the user gets visual feedback
      // that their click registered, while the browser prepares the file.
      setTimeout(() => {
        URL.revokeObjectURL(url);
        setDownloadingId(null);
      }, 2500);

    } catch (e) {
      console.error('Download failed:', e);
      const reason = e instanceof Error
        ? e.message
        : 'The file may have been cleared by another tab or session.';
      alert('Download failed: ' + reason);
      setDownloadingId(null);
    }
  };

  return (
    <div className="fileshare-container glass-panel">
      <div className="panel-header">
        <Share2 size={20} className="text-primary-400" />
        <h2>Share files</h2>
      </div>
      
      <div 
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (status === 'connected') setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (status === 'connected') handleFileSelect(e.dataTransfer.files);
        }}
        onClick={() => status === 'connected' && fileInputRef.current?.click()}
        style={{ opacity: status !== 'connected' ? 0.5 : 1, cursor: status !== 'connected' ? 'not-allowed' : 'pointer' }}
      >
        <div className="flex-col items-center gap-2">
          <UploadCloud size={32} className="text-zinc-400" />
          <p className="text-zinc-300">
            {status === 'connected' ? 'Drag and drop files here, or click to pick files' : 'Upload disabled (offline)'}
          </p>
        </div>
        <input 
          type="file" 
          multiple 
          className="hidden" 
          ref={fileInputRef}
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      <div className="file-list">
        {(files.length > 0 || Object.keys(progresses).length > 0) && (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.5rem' }}>
            <span>🛡️</span>
            <span>Make sure you trust the sender before opening files.</span>
          </div>
        )}
        
        {Object.entries(progresses).map(([fileId, p]) => (
          <div key={`prog-${fileId}`} className="file-item" style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Very subtle background fill for progress */}
            <div 
              style={{
                position: 'absolute', 
                top: 0, left: 0, bottom: 0, 
                width: `${Math.max(1, (p.bytes/p.total)*100)}%`, 
                background: 'rgba(34, 211, 238, 0.08)',
                transition: 'width 0.3s ease',
                zIndex: 0,
                borderRadius: 'var(--radius-md)',
                maxWidth: 'calc(100% - 2px)'
              }} 
            />
            {/* Top edge highlight */}
            <div 
              style={{
                position: 'absolute', 
                top: 0, left: 0, height: '2px', 
                width: `${Math.max(1, (p.bytes/p.total)*100)}%`, 
                background: 'var(--primary-color)',
                transition: 'width 0.3s ease',
                zIndex: 1,
                borderRadius: 'var(--radius-md)',
                maxWidth: 'calc(100% - 2px)'
              }} 
            />

            <div className="file-info" style={{ zIndex: 2, position: 'relative' }}>
              <FileIcon size={24} className={p.type === 'upload' ? "text-cyan-400" : "text-green-400"} />
              <div className="file-details" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="file-name">{p.name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0, marginLeft: '12px' }}>
                    {p.type === 'upload' ? 'Sending' : 'Receiving'}... {Math.round((p.bytes/p.total)*100)}%
                  </span>
                </div>
                <span className="file-meta">
                  {formatSize(p.bytes)} / {formatSize(p.total)} • {getDisplayFormat(p.name)}
                </span>
              </div>
            </div>
          </div>
        ))}

        {queue.map((item) => (
          <div key={item.id} className="file-item" style={{ opacity: 0.7 }}>
            <div className="file-info">
              <FileIcon size={24} className="text-zinc-500" />
              <div className="file-details">
                <span className="file-name">{item.file.name}</span>
                <span className="file-meta">{formatSize(item.file.size)} • {getDisplayFormat(item.file.name, item.file.type)} • Waiting...</span>
              </div>
            </div>
            <button
              className="btn-icon"
              onClick={() => setQueue(prev => prev.filter(q => q.id !== item.id))}
              aria-label="Remove from queue"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} />
            </button>
          </div>
        ))}

        {files.length === 0 && Object.keys(progresses).length === 0 && queue.length === 0 && (
          <div className="file-empty text-center text-zinc-500 mt-4">
            No files shared yet.
          </div>
        )}
        {files.filter(f => !progresses[f.id]).map((f) => {
          const DynamicIcon = getFileIcon(f.type);
          return (
            <div key={f.id} className="file-item">
              <div className="file-info">
                <DynamicIcon size={24} className={f.sender === 'me' ? "text-cyan-400" : "text-green-400"} />
                <div className="file-details">
                  <span className="file-name">{f.name}</span>
                  <span className="file-meta">{formatSize(f.size)} • {getDisplayFormat(f.name, f.type)} • {f.sender === 'me' ? 'Sent' : 'Received'}</span>
                </div>
              </div>
            {f.sender === 'peer' ? (
              <button 
                className="btn-download-circle" 
                onClick={() => handleDownload(f)} 
                disabled={downloadingId === f.id}
                title={downloadingId === f.id ? "Preparing download..." : "Download"}
              >
                {downloadingId === f.id ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
              </button>
            ) : (
              <div className="file-status text-green-400"><CheckCircle2 size={20} /></div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
};
