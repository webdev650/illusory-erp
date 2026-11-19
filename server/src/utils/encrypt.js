// src/utils/encrypt.js
// Backward-compatible wrapper delegating to modern crypto utility
import { encrypt, decrypt, mask } from './crypto.js';

export { encrypt, decrypt, mask };
export default { encrypt, decrypt, mask };
