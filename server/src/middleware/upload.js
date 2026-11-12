// src/middleware/upload.js
// Configures multer to upload files directly to Cloudinary.
// Files are limited to 5 MB; only JPG, PNG, and PDF are accepted.
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import { AppError } from './error.js';
import '../config/cloudinary.js'; // Make sure cloudinary is configured

const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const folder = file.mimetype === 'application/pdf'
      ? 'illusory-erp/documents'
      : 'illusory-erp/photos';
    return {
      folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
      resource_type: file.mimetype === 'application/pdf' ? 'raw' : 'image',
    };
  },
});

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only JPG, PNG, and PDF files are allowed', 400), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
