import mongoose from 'mongoose';

const maintenanceRecordSchema = new mongoose.Schema(
  {
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['repair', 'service', 'upgrade', 'inspection'],
      default: 'repair',
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    issue: {
      type: String,
      required: [true, 'Issue description is required'],
      trim: true,
    },
    vendor: {
      type: String,
      trim: true,
      default: '',
    },
    cost: {
      type: Number, // Integer paise
      default: 0,
      min: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'completed'],
      default: 'open',
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
    attachments: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const MaintenanceRecord = mongoose.model('MaintenanceRecord', maintenanceRecordSchema);
export default MaintenanceRecord;
