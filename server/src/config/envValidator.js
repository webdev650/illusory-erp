import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pre-load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

/**
 * Validates and normalizes environment variables on startup.
 * Fails fast with clear, friendly messages if any critical key is missing.
 */
export const validateEnv = () => {
  const missing = [];

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) missing.push('MONGO_URI (or MONGODB_URI)');

  const jwtSecret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!jwtSecret) missing.push('JWT_SECRET (or JWT_ACCESS_SECRET)');

  const encryptionKey =
    process.env.ENCRYPTION_KEY ||
    process.env.ASSET_SECRET_KEY ||
    process.env.FIELD_ENCRYPTION_KEY;
  if (!encryptionKey) {
    missing.push('ENCRYPTION_KEY (or ASSET_SECRET_KEY)');
  }

  if (missing.length > 0) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ FATAL: Missing Required Environment Variable(s):');
    missing.forEach((item) => console.error(`   - ${item}`));
    console.error('\nPlease update server/.env with valid credentials before starting.');
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }

  // Normalize aliases so the rest of the codebase can use standard keys
  process.env.MONGO_URI = mongoUri;
  process.env.MONGODB_URI = mongoUri;
  process.env.JWT_SECRET = jwtSecret;
  process.env.JWT_ACCESS_SECRET = jwtSecret;
  process.env.ENCRYPTION_KEY = encryptionKey;
  process.env.ASSET_SECRET_KEY = encryptionKey;
  process.env.FIELD_ENCRYPTION_KEY = encryptionKey;
  process.env.PORT = process.env.PORT || '5000';
  process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';

  return {
    port: parseInt(process.env.PORT, 10),
    nodeEnv: process.env.NODE_ENV,
    mongoUri,
    jwtSecret,
    encryptionKey,
    clientUrl: process.env.CLIENT_URL,
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
      apiKey: process.env.CLOUDINARY_API_KEY || '',
      apiSecret: process.env.CLOUDINARY_API_SECRET || '',
      isConfigured: Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
      ),
    },
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      fromEmail: process.env.FROM_EMAIL || '"Illusory ERP" <notifications@illusorydesignstudios.com>',
      isConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    },
  };
};

export const env = validateEnv();
