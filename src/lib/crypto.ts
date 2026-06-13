export async function generateKeyPair() {
  return await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  const exportedArray = new Uint8Array(exported);
  return btoa(String.fromCharCode(...exportedArray));
}

export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    "raw",
    bytes.buffer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

export async function deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function deriveKeyFromPassword(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  
  const salt = encoder.encode("p2pear-signaling-salt-2026"); 
  
  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptPayload(key: CryptoKey, payload: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedPayload = new TextEncoder().encode(payload);
  
  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encodedPayload
  );

  const ciphertextArray = new Uint8Array(encryptedContent);
  const ciphertext = btoa(String.fromCharCode(...ciphertextArray));
  const ivString = btoa(String.fromCharCode(...iv));

  return { ciphertext, iv: ivString };
}

export async function decryptPayload(key: CryptoKey, ciphertextBase64: string, ivBase64: string): Promise<string> {
  const ciphertextStr = atob(ciphertextBase64);
  const ciphertextBytes = new Uint8Array(ciphertextStr.length);
  for (let i = 0; i < ciphertextStr.length; i++) {
    ciphertextBytes[i] = ciphertextStr.charCodeAt(i);
  }

  const ivStr = atob(ivBase64);
  const ivBytes = new Uint8Array(ivStr.length);
  for (let i = 0; i < ivStr.length; i++) {
    ivBytes[i] = ivStr.charCodeAt(i);
  }

  const decryptedContent = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    ciphertextBytes
  );

  return new TextDecoder().decode(decryptedContent);
}

// For encrypting files (Blobs)
export async function encryptBlob(key: CryptoKey, blob: Blob): Promise<{ encryptedBlob: Blob; iv: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const arrayBuffer = await blob.arrayBuffer();
  
  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    arrayBuffer
  );

  const ivString = btoa(String.fromCharCode(...iv));
  return { encryptedBlob: new Blob([encryptedContent]), iv: ivString };
}

export async function decryptBlob(key: CryptoKey, encryptedBlob: Blob, ivBase64: string, type: string): Promise<Blob> {
  const arrayBuffer = await encryptedBlob.arrayBuffer();
  
  const ivStr = atob(ivBase64);
  const ivBytes = new Uint8Array(ivStr.length);
  for (let i = 0; i < ivStr.length; i++) {
    ivBytes[i] = ivStr.charCodeAt(i);
  }

  const decryptedContent = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    arrayBuffer
  );

  return new Blob([decryptedContent], { type });
}

export async function encryptChunk(key: CryptoKey, chunk: Uint8Array, iv: Uint8Array): Promise<ArrayBuffer> {
  return await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as any },
    key,
    chunk as any
  );
}

export async function decryptChunk(key: CryptoKey, encryptedChunk: Uint8Array, iv: Uint8Array): Promise<ArrayBuffer> {
  return await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as any },
    key,
    encryptedChunk as any
  );
}
