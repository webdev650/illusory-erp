import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';
import { AppError } from './error.js';

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isDoc = file.mimetype === 'application/pdf';
    return {
      folder: isDoc ? 'illusory-erp/documents' : 'illusory-erp/photos',
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
      resource_type: isDoc ? 'raw' : 'image',
      public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9]/g, '_')}`,
    };
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only JPG, PNG, and PDF files are allowed.', 400), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
});
