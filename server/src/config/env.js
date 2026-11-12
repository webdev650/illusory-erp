// src/config/env.js
// Loads and validates all environment variables at startup.
// If a required variable is missing the app will crash early with a clear error.
import dotenv from 'dotenv';
dotenv.config();

const required = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'FIELD_ENCRYPTION_KEY',
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌  Missing required env variable: ${key}`);
    process.exit(1);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  mongoUri: process.env.MONGODB_URI,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  fieldEncryptionKey: process.env.FIELD_ENCRYPTION_KEY,
  ceo: {
    name: process.env.CEO_NAME || 'CEO',
    email: process.env.CEO_EMAIL || 'ceo@illusorydesignstudios.com',
    password: process.env.CEO_PASSWORD || 'ChangeMe@123',
    employeeId: process.env.CEO_EMPLOYEE_ID || 'IDS001',
  },
};
