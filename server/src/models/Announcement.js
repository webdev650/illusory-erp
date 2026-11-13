import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    audience: {
      type: String,
      enum: ['all', 'department', 'role'],
      default: 'all',
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      default: null,
    },
    pinned: { type: Boolean, default: false },
    attachment: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    expiresAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

announcementSchema.index({ pinned: -1, createdAt: -1 });

export const Announcement = mongoose.model('Announcement', announcementSchema);
export default Announcement;

