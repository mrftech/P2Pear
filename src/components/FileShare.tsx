import React, { useState, useEffect, useRef } from 'react';
import { WebRTCManager } from '../lib/webrtc';
import { getFiles, type SharedFile } from '../lib/db';
import { UploadCloud, File as FileIcon, Download, CheckCircle2, Share2, Loader2, Image as ImageIcon, Film, FileText, FileArchive, FileCode, FileAudio } from 'lucide-react';

interface FileShareProps {
  rtcManager: WebRTCManager;
  refreshTrigger: number;
}

export const FileShare: React.FC<FileShareProps> = ({ rtcManager, refreshTrigger }) => {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [progresses, setProgresses] = useState<{
    [fileId: string]: { name: string, bytes: number, total: number, type: 'upload' | 'download' }
  }>({});
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
    for (let i = 0; i < selectedFiles.length; i++) {
      try {
        await rtcManager.sendFile(selectedFiles[i]);
      } catch (e) {
        console.error('Failed to send file:', e);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

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
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex-col items-center gap-2">
          <UploadCloud size={32} className="text-zinc-400" />
          <p className="text-zinc-300">Drag and drop files here, or click to pick files</p>
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
                zIndex: 0
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
                zIndex: 1
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

        {files.length === 0 && Object.keys(progresses).length === 0 && (
          <div className="file-empty text-center text-zinc-500 mt-4">
            No files shared yet.
          </div>
        )}
        {files.map((f) => {
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
                className="btn btn-icon" 
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
