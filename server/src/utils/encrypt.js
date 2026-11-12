// src/utils/encrypt.js
// Encrypts and decrypts sensitive fields (Aadhaar, PAN, bank account)
// using AES-256 so they are stored as ciphertext in MongoDB.
import CryptoJS from 'crypto-js';
import { env } from '../config/env.js';

const KEY = env.fieldEncryptionKey;

export const encrypt = (plainText) => {
  if (!plainText) return plainText;
  return CryptoJS.AES.encrypt(String(plainText), KEY).toString();
};

export const decrypt = (cipherText) => {
  if (!cipherText) return cipherText;
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return null; // Return null if decryption fails
  }
};
