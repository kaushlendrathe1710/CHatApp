/**
 * End-to-End Encryption Utilities
 * Uses Web Crypto API with RSA-OAEP for message encryption
 */

const PRIVATE_KEY_STORAGE_KEY = 'e2ee_private_key';
const PUBLIC_KEY_STORAGE_KEY = 'e2ee_public_key';
const KEY_VERSION_STORAGE_KEY = 'e2ee_key_version';
const CURRENT_KEY_VERSION = '1.0';

export interface EncryptionKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

/**
 * Generate a new RSA-OAEP key pair for encryption
 */
export async function generateKeyPair(): Promise<EncryptionKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  return keyPair;
}

/**
 * Export a public key to base64 format for storage/transmission
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', publicKey);
  const exportedAsBase64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  return exportedAsBase64;
}

/**
 * Import a public key from base64 format
 */
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const publicKey = await crypto.subtle.importKey(
    'spki',
    bytes,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );

  return publicKey;
}

/**
 * Export a private key to base64 format for storage
 */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  const exportedAsBase64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  return exportedAsBase64;
}

/**
 * Import a private key from base64 format
 */
export async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    bytes,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );

  return privateKey;
}

/**
 * Store key pair in localStorage with version tracking
 */
export async function storeKeyPair(keyPair: EncryptionKeyPair): Promise<void> {
  const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
  const privateKeyBase64 = await exportPrivateKey(keyPair.privateKey);

  localStorage.setItem(PUBLIC_KEY_STORAGE_KEY, publicKeyBase64);
  localStorage.setItem(PRIVATE_KEY_STORAGE_KEY, privateKeyBase64);
  localStorage.setItem(KEY_VERSION_STORAGE_KEY, CURRENT_KEY_VERSION);
}

/**
 * Retrieve stored key pair from localStorage with version validation
 */
export async function getStoredKeyPair(): Promise<EncryptionKeyPair | null> {
  const publicKeyBase64 = localStorage.getItem(PUBLIC_KEY_STORAGE_KEY);
  const privateKeyBase64 = localStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
  const storedVersion = localStorage.getItem(KEY_VERSION_STORAGE_KEY);

  if (!publicKeyBase64 || !privateKeyBase64) {
    return null;
  }

  // Check version compatibility
  if (storedVersion !== CURRENT_KEY_VERSION) {
    console.warn('Stored keys have incompatible version. Clearing keys.');
    clearEncryptionKeys();
    return null;
  }

  try {
    const publicKey = await importPublicKey(publicKeyBase64);
    const privateKey = await importPrivateKey(privateKeyBase64);
    return { publicKey, privateKey };
  } catch (error) {
    console.error('Failed to retrieve stored keys (possible corruption):', error);
    // Clear corrupted keys
    clearEncryptionKeys();
    throw new Error('Encryption keys are corrupted. Please set up encryption again.');
  }
}

/**
 * Get stored public key as base64 string
 */
export function getStoredPublicKeyBase64(): string | null {
  return localStorage.getItem(PUBLIC_KEY_STORAGE_KEY);
}

/**
 * Encrypt a message using hybrid encryption (RSA-OAEP + AES-GCM)
 * This allows encrypting messages of any length
 * @param message - The plaintext message to encrypt
 * @param recipientPublicKeyBase64 - The recipient's public key in base64 format
 * @returns Base64-encoded encrypted package (encrypted symmetric key + encrypted message)
 */
export async function encryptMessage(
  message: string,
  recipientPublicKeyBase64: string
): Promise<string> {
  const recipientPublicKey = await importPublicKey(recipientPublicKeyBase64);
  
  // Generate a random AES-GCM key for this message
  const symmetricKey = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );

  // Encrypt the message with AES-GCM
  const encoder = new TextEncoder();
  const messageData = encoder.encode(message);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  
  const encryptedMessage = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    symmetricKey,
    messageData
  );

  // Export and encrypt the symmetric key with RSA-OAEP
  const exportedSymmetricKey = await crypto.subtle.exportKey('raw', symmetricKey);
  const encryptedSymmetricKey = await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    recipientPublicKey,
    exportedSymmetricKey
  );

  // Combine: [encrypted symmetric key length (2 bytes)][encrypted symmetric key][IV (12 bytes)][encrypted message]
  const encryptedSymKeyArray = new Uint8Array(encryptedSymmetricKey);
  const encryptedMessageArray = new Uint8Array(encryptedMessage);
  
  const combined = new Uint8Array(
    2 + encryptedSymKeyArray.length + iv.length + encryptedMessageArray.length
  );
  
  // Store the length of encrypted symmetric key (2 bytes)
  combined[0] = encryptedSymKeyArray.length >> 8;
  combined[1] = encryptedSymKeyArray.length & 0xFF;
  
  // Copy encrypted symmetric key
  combined.set(encryptedSymKeyArray, 2);
  
  // Copy IV
  combined.set(iv, 2 + encryptedSymKeyArray.length);
  
  // Copy encrypted message
  combined.set(encryptedMessageArray, 2 + encryptedSymKeyArray.length + iv.length);

  // Convert to base64
  const combinedAsBase64 = btoa(String.fromCharCode(...combined));
  return combinedAsBase64;
}

/**
 * Decrypt a message using hybrid decryption (RSA-OAEP + AES-GCM)
 * @param encryptedMessageBase64 - The encrypted message package in base64 format
 * @returns Decrypted plaintext message
 */
export async function decryptMessage(encryptedMessageBase64: string): Promise<string> {
  const keyPair = await getStoredKeyPair();
  if (!keyPair) {
    throw new Error('No private key found. Please set up encryption first.');
  }

  // Decode base64
  const binaryString = atob(encryptedMessageBase64);
  const combined = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    combined[i] = binaryString.charCodeAt(i);
  }

  // Extract encrypted symmetric key length (2 bytes)
  const encryptedSymKeyLength = (combined[0] << 8) | combined[1];
  
  // Extract encrypted symmetric key
  const encryptedSymKey = combined.slice(2, 2 + encryptedSymKeyLength);
  
  // Extract IV (12 bytes)
  const iv = combined.slice(2 + encryptedSymKeyLength, 2 + encryptedSymKeyLength + 12);
  
  // Extract encrypted message
  const encryptedMessage = combined.slice(2 + encryptedSymKeyLength + 12);

  // Decrypt the symmetric key with RSA-OAEP
  const decryptedSymKeyBuffer = await crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP',
    },
    keyPair.privateKey,
    encryptedSymKey
  );

  // Import the decrypted symmetric key
  const symmetricKey = await crypto.subtle.importKey(
    'raw',
    decryptedSymKeyBuffer,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['decrypt']
  );

  // Decrypt the message with AES-GCM
  const decryptedMessage = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    symmetricKey,
    encryptedMessage
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedMessage);
}

/**
 * Check if user has encryption keys set up
 */
export function hasEncryptionKeys(): boolean {
  return (
    localStorage.getItem(PUBLIC_KEY_STORAGE_KEY) !== null &&
    localStorage.getItem(PRIVATE_KEY_STORAGE_KEY) !== null
  );
}

/**
 * Clear all stored encryption keys (for logout, reset, or corruption)
 */
export function clearEncryptionKeys(): void {
  localStorage.removeItem(PUBLIC_KEY_STORAGE_KEY);
  localStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
  localStorage.removeItem(KEY_VERSION_STORAGE_KEY);
}
