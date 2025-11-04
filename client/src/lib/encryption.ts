/**
 * End-to-End Encryption Utilities
 * Uses Web Crypto API with RSA-OAEP for message encryption
 */

const PRIVATE_KEY_STORAGE_KEY = 'e2ee_private_key';
const PUBLIC_KEY_STORAGE_KEY = 'e2ee_public_key';

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
 * Store key pair in localStorage
 */
export async function storeKeyPair(keyPair: EncryptionKeyPair): Promise<void> {
  const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
  const privateKeyBase64 = await exportPrivateKey(keyPair.privateKey);

  localStorage.setItem(PUBLIC_KEY_STORAGE_KEY, publicKeyBase64);
  localStorage.setItem(PRIVATE_KEY_STORAGE_KEY, privateKeyBase64);
}

/**
 * Retrieve stored key pair from localStorage
 */
export async function getStoredKeyPair(): Promise<EncryptionKeyPair | null> {
  const publicKeyBase64 = localStorage.getItem(PUBLIC_KEY_STORAGE_KEY);
  const privateKeyBase64 = localStorage.getItem(PRIVATE_KEY_STORAGE_KEY);

  if (!publicKeyBase64 || !privateKeyBase64) {
    return null;
  }

  try {
    const publicKey = await importPublicKey(publicKeyBase64);
    const privateKey = await importPrivateKey(privateKeyBase64);
    return { publicKey, privateKey };
  } catch (error) {
    console.error('Failed to retrieve stored keys:', error);
    return null;
  }
}

/**
 * Get stored public key as base64 string
 */
export function getStoredPublicKeyBase64(): string | null {
  return localStorage.getItem(PUBLIC_KEY_STORAGE_KEY);
}

/**
 * Encrypt a message using a recipient's public key
 * @param message - The plaintext message to encrypt
 * @param recipientPublicKeyBase64 - The recipient's public key in base64 format
 * @returns Base64-encoded encrypted message
 */
export async function encryptMessage(
  message: string,
  recipientPublicKeyBase64: string
): Promise<string> {
  const recipientPublicKey = await importPublicKey(recipientPublicKeyBase64);
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    recipientPublicKey,
    data
  );

  const encryptedAsBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  return encryptedAsBase64;
}

/**
 * Decrypt a message using the user's private key
 * @param encryptedMessageBase64 - The encrypted message in base64 format
 * @returns Decrypted plaintext message
 */
export async function decryptMessage(encryptedMessageBase64: string): Promise<string> {
  const keyPair = await getStoredKeyPair();
  if (!keyPair) {
    throw new Error('No private key found. Please set up encryption first.');
  }

  const binaryString = atob(encryptedMessageBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP',
    },
    keyPair.privateKey,
    bytes
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
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
 * Clear all stored encryption keys (for logout or reset)
 */
export function clearEncryptionKeys(): void {
  localStorage.removeItem(PUBLIC_KEY_STORAGE_KEY);
  localStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
}
