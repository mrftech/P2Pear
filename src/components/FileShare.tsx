import React, { useState, useEffect, useRef } from 'react';
import { WebRTCManager } from '../lib/webrtc';
import { getFiles, type SharedFile } from '../lib/db';
import { UploadCloud, File as FileIcon, Download, CheckCircle2, Share2 } from 'lucide-react';

interface FileShareProps {
  rtcManager: WebRTCManager;
  refreshTrigger: number;
}

export const FileShare: React.FC<FileShareProps> = ({ rtcManager, refreshTrigger }) => {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
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
      let finalBlob = file.blob;
      if (file.fileHandle) {
        const handle = file.fileHandle as FileSystemFileHandle;
        finalBlob = await handle.getFile();
      }
      
      if (!finalBlob) throw new Error("No file data found.");

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error("Download failed:", e);
      alert("Failed to download file. It may be corrupted or unavailable.");
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
      >
        <div className="flex-col items-center gap-2">
          <UploadCloud size={32} className="text-zinc-400" />
          <p className="text-zinc-300">Drag and drop files here</p>
          <div className="flex-row mt-2" style={{ gap: '1rem' }}>
            <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>
              Select Files
            </button>
            <button className="btn btn-outline" onClick={() => folderInputRef.current?.click()}>
              Select Folder
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
              <FileIcon size={24} className="text-cyan-400" />
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
