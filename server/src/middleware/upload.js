import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';
import { AppError } from './error.js';

// Standard profile and document storage (max 5MB)
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

// Task & Project Attachments storage (supports jpg/png/pdf/zip/docx/fig, max 10MB)
const attachmentStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isImg = file.mimetype.startsWith('image/');
    return {
      folder: 'illusory-erp/attachments',
      resource_type: isImg ? 'image' : 'raw',
      public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
    };
  },
});

const attachmentFileFilter = (req, file, cb) => {
  const allowedExts = /\.(jpg|jpeg|png|pdf|zip|docx|doc|fig)$/i;
  const isExtValid = allowedExts.test(file.originalname);

  if (isExtValid) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Invalid attachment format. Only JPG, PNG, PDF, ZIP, DOCX, and FIG files up to 10MB are permitted.',
        400
      ),
      false
    );
  }
};

export const taskAttachmentUpload = multer({
  storage: attachmentStorage,
  fileFilter: attachmentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
});
