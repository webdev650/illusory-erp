import cloudinary from '../config/cloudinary.js';
import { logger } from '../utils/logger.js';

/**
 * Programmatic file upload and deletion service using Cloudinary.
 */

/**
 * Upload a raw buffer to Cloudinary using an upload_stream.
 * Useful for generated PDFs, invoices, payslips, or charts.
 */
export const uploadBufferToCloudinary = (
  buffer,
  { folder = 'illusory-erp/generated', filename = 'document', resourceType = 'auto' } = {}
) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.v2.uploader.upload_stream(
      {
        folder,
        public_id: `${Date.now()}-${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          logger.error({ error }, 'Cloudinary uploadBuffer error');
          return reject(error);
        }
        return resolve({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );
    stream.end(buffer);
  });
};

/**
 * Delete a file from Cloudinary by its public ID.
 */
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!publicId) return { success: true };
  try {
    const res = await cloudinary.v2.uploader.destroy(publicId, { resource_type: resourceType });
    return { success: res.result === 'ok' || res.result === 'not found', result: res.result };
  } catch (error) {
    logger.error({ error: error.message, publicId }, 'Failed to delete file from Cloudinary');
    return { success: false, error: error.message };
  }
};

export default {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
};
