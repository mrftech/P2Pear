import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface ChatMessage {
  id?: number;
  sender: 'me' | 'peer';
  text: string;
  timestamp: number;
}

export interface SharedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  blob?: Blob;
  fileHandle?: any;
  sender: 'me' | 'peer';
  timestamp: number;
}

interface SwarmGridDB extends DBSchema {
  messages: {
    key: number;
    value: ChatMessage;
    indexes: { 'by-timestamp': number };
  };
  files: {
    key: string;
    value: SharedFile;
    indexes: { 'by-timestamp': number };
  };
}

let dbPromise: Promise<IDBPDatabase<SwarmGridDB>> | null = null;

export function initDB() {
  if (!dbPromise) {
    const dbName = `swarmgrid-db`;
    
    dbPromise = openDB<SwarmGridDB>(dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
          msgStore.createIndex('by-timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }
  return dbPromise;
}

export async function addMessage(msg: Omit<ChatMessage, 'id'>) {
  const db = await initDB();
  return db.add('messages', msg as ChatMessage);
}

export async function getMessages(): Promise<ChatMessage[]> {
  const db = await initDB();
  return db.getAllFromIndex('messages', 'by-timestamp');
}

export async function addFile(file: SharedFile) {
  const db = await initDB();
  return db.add('files', file);
}

export async function getFiles(): Promise<SharedFile[]> {
  const db = await initDB();
  return db.getAllFromIndex('files', 'by-timestamp');
}

export async function clearWorkspace() {
  const db = await initDB();
  await db.clear('messages');
  await db.clear('files');
  
  // Also wipe OPFS (Origin Private File System) to prevent massive storage leaks
  try {
    const root = await navigator.storage.getDirectory();
    // @ts-ignore - TS doesn't fully support async iteration on OPFS yet
    for await (const name of root.keys()) {
      await root.removeEntry(name, { recursive: true });
    }
  } catch (e) {
    console.error("Failed to wipe OPFS:", e);
  }
}

export async function wipeOnNewSession() {
  if (!sessionStorage.getItem('swarmgrid-session-active')) {
    // This is a brand new tab or window, not a refresh.
    // Burn the old workspace to prevent privacy leaks.
    console.log('[DB] New session detected. Wiping old workspace...');
    await clearWorkspace();
    sessionStorage.setItem('swarmgrid-session-active', 'true');
  } else {
    console.log('[DB] F5 Refresh detected. Preserving workspace.');
  }
}
