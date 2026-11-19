import CryptoJS from 'crypto-js';

const getDefaultKey = () => {
  return (
    process.env.ENCRYPTION_KEY ||
    process.env.ASSET_SECRET_KEY ||
    process.env.FIELD_ENCRYPTION_KEY ||
    'illusory_erp_default_secure_key_32chars!'
  );
};

/**
 * Encrypt a plaintext string using AES-256.
 * Returns Base64 ciphertext string.
 */
export const encrypt = (plainText, customKey = null) => {
  if (plainText === null || plainText === undefined || plainText === '') {
    return plainText;
  }
  const key = customKey || getDefaultKey();
  return CryptoJS.AES.encrypt(String(plainText), key).toString();
};

/**
 * Decrypt an AES-256 ciphertext string.
 * Returns UTF-8 plaintext string or null if decryption fails.
 */
export const decrypt = (cipherText, customKey = null) => {
  if (cipherText === null || cipherText === undefined || cipherText === '') {
    return cipherText;
  }
  const key = customKey || getDefaultKey();
  try {
    const bytes = CryptoJS.AES.decrypt(String(cipherText), key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) return null;
    return decrypted;
  } catch {
    return null;
  }
};

/**
 * Mask sensitive string for safe display.
 * e.g., Aadhaar: ********1234, Bank: *******5678, PAN: ABCDE****F
 */
export const mask = (value, { visibleStart = 0, visibleEnd = 4, maskChar = '*' } = {}) => {
  if (!value || typeof value !== 'string') return value;
  const str = String(value).trim();
  if (str.length <= visibleStart + visibleEnd) {
    return maskChar.repeat(str.length);
  }
  const start = str.slice(0, visibleStart);
  const end = str.slice(str.length - visibleEnd);
  const middle = maskChar.repeat(str.length - visibleStart - visibleEnd);
  return `${start}${middle}${end}`;
};

export default {
  encrypt,
  decrypt,
  mask,
};
