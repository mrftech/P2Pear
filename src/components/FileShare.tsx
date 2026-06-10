import React, { useState, useEffect, useRef } from 'react';
import { WebRTCManager } from '../lib/webrtc';
import { getFiles, type SharedFile } from '../lib/db';
import { UploadCloud, File as FileIcon, Download, CheckCircle2, Share2, Image as ImageIcon, Film, FileText, FileAudio, Archive, FileDown, Loader2 } from 'lucide-react';
import * as fflate from 'fflate';

interface FileShareProps {
  rtcManager: WebRTCManager;
  refreshTrigger: number;
}

export const FileShare: React.FC<FileShareProps> = ({ rtcManager, refreshTrigger }) => {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [progresses, setProgresses] = useState<{
    [fileId: string]: { name: string, bytes: number, total: number, type: 'upload' | 'download' }
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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



  const handleFileSelect = async (selectedFiles: FileList | File[] | null) => {
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.items) {
      const files: File[] = [];
      const promises: Promise<void>[] = [];
      
      const traverseFileTree = (item: any, path: string) => {
        return new Promise<void>((resolve) => {
          if (item.isFile) {
            item.file((file: File) => {
              files.push(file);
              resolve();
            });
          } else if (item.isDirectory) {
            const dirReader = item.createReader();
            dirReader.readEntries((entries: any[]) => {
              const subPromises = entries.map((entry: any) => traverseFileTree(entry, path + item.name + "/"));
              Promise.all(subPromises).then(() => resolve());
            });
          } else {
            resolve();
          }
        });
      };

      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i].webkitGetAsEntry();
        if (item) {
          promises.push(traverseFileTree(item, ""));
        }
      }
      
      await Promise.all(promises);
      if (files.length > 0) {
        handleFileSelect(files);
      }
    } else {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDownload = async (file: SharedFile) => {
    try {
      if (file.fileHandle && 'showSaveFilePicker' in window) {
        try {
          const handle = file.fileHandle as FileSystemFileHandle;
          const opfsFile = await handle.getFile();
          
          // Use modern File System Access API to stream directly to disk (Zero corruption, unlimited size)
          const saveHandle = await (window as any).showSaveFilePicker({
            suggestedName: file.name
          });
          const writable = await saveHandle.createWritable();
          await opfsFile.stream().pipeTo(writable);
          return; // Success!
        } catch (err: any) {
          if (err.name === 'AbortError') return; // User cancelled
          console.warn("showSaveFilePicker failed, falling back to Blob URL", err);
        }
      }

      let finalBlob = file.blob;
      if (file.fileHandle) {
        const handle = file.fileHandle as FileSystemFileHandle;
        const opfsFile = await handle.getFile();
        // Bypass Chromium OPFS Blob URL corruption by forcing it into RAM
        const buffer = await opfsFile.arrayBuffer();
        finalBlob = new Blob([buffer], { type: file.type || 'application/octet-stream' });
      }
      
      if (!finalBlob) throw new Error("No file data found.");

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000); // 60 seconds to prevent truncation
    } catch (e) {
      console.error("Download failed:", e);
      alert("Failed to download file. It may be corrupted or unavailable.");
    }
  };

  const handleDownloadAll = async () => {
    if (isZipping) return;
    const receivedFiles = files.filter(f => f.sender === 'peer');
    if (receivedFiles.length === 0) return;
    
    setIsZipping(true);
    // Yield to event loop to allow React to render the loading state
    await new Promise(r => setTimeout(r, 50));
    
    try {
      // Build zip file system
      const zipData: Record<string, Uint8Array> = {};
      for (const f of receivedFiles) {
        let blob = f.blob;
        if (f.fileHandle) {
          const handle = f.fileHandle as FileSystemFileHandle;
          blob = await handle.getFile();
        }
        if (blob) {
          const arrayBuffer = await blob.arrayBuffer();
          // Resolve filename collisions
          let filename = f.name;
          let counter = 1;
          while (zipData[filename]) {
            const parts = f.name.split('.');
            const ext = parts.length > 1 ? '.' + parts.pop() : '';
            const base = parts.join('.');
            filename = `${base} (${counter})${ext}`;
            counter++;
          }
          zipData[filename] = new Uint8Array(arrayBuffer);
        }
      }
      
      // Generate ZIP asynchronously to prevent complete UI lockup
      fflate.zip(zipData, (err, zipped) => {
        if (err) {
          console.error(err);
          setIsZipping(false);
          alert("Failed to compress files.");
          return;
        }
        const blob = new Blob([zipped], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `P2Pear_Files_${new Date().getTime()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000); // 60 seconds to prevent truncation
        setIsZipping(false);
      });
    } catch (e) {
      console.error(e);
      setIsZipping(false);
    }
  };

  const getFileIcon = (file: SharedFile | null, mimeType?: string) => {
    const type = file ? file.type : mimeType;
    if (!type) return <FileIcon size={24} className="text-cyan-400" />;
    if (type.startsWith('image/')) return <ImageIcon size={24} className="text-cyan-400" />;
    if (type.startsWith('video/')) return <Film size={24} className="text-cyan-400" />;
    if (type.startsWith('audio/')) return <FileAudio size={24} className="text-cyan-400" />;
    if (type.includes('pdf')) return <FileText size={24} className="text-cyan-400" />;
    if (type.includes('zip') || type.includes('archive') || type.includes('compressed')) return <Archive size={24} className="text-cyan-400" />;
    return <FileIcon size={24} className="text-cyan-400" />;
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
      >
        <div className="flex-col" style={{ alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <div className="upload-icon-wrapper">
            <UploadCloud size={40} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <h3 style={{ margin: '0.5rem 0 0 0', fontWeight: 600, fontSize: '1.2rem' }}>Drag & drop files or folders here</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            or choose a selection method below
          </p>
          <div className="flex-row mt-3" style={{ gap: '1rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
              Browse Files
            </button>
            <button className="btn btn-outline" onClick={() => folderInputRef.current?.click()}>
              Browse Folders
            </button>
          </div>
        </div>
        <input 
          type="file" 
          multiple 
          className="hidden" 
          ref={fileInputRef}
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <input 
          type="file" 
          {...{ webkitdirectory: "", directory: "" } as any}
          multiple 
          className="hidden" 
          ref={folderInputRef}
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      <div className="file-list">
        {files.filter(f => f.sender === 'peer').length > 1 && (
          <div className="flex-row justify-between mb-md" style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
            <span className="text-zinc-300 font-medium">Received {files.filter(f => f.sender === 'peer').length} files</span>
            <button 
              className="btn btn-primary" 
              onClick={handleDownloadAll} 
              disabled={isZipping}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {isZipping ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Zipping...
                </>
              ) : (
                <>
                  <FileDown size={16} />
                  Download All as ZIP
                </>
              )}
            </button>
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
                  {formatSize(p.bytes)} / {formatSize(p.total)}
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
        {files.map((f) => (
          <div key={f.id} className="file-item">
            <div className="file-info">
              {getFileIcon(f)}
              <div className="file-details">
                <span className="file-name">{f.name}</span>
                <span className="file-meta">{formatSize(f.size)} • {f.sender === 'me' ? 'Sent' : 'Received'}</span>
              </div>
            </div>
            {f.sender === 'peer' ? (
              <button className="btn btn-icon" onClick={() => handleDownload(f)} title="Download">
                <Download size={20} />
              </button>
            ) : (
              <div className="file-status text-green-400"><CheckCircle2 size={20} /></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
