import mongoose from 'mongoose';

const criticalDateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    dateStr: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['shoot', 'client_milestone', 'deadline', 'event', 'other'],
      default: 'event',
    },
    description: {
      type: String,
      default: '',
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null, // null means all departments
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

criticalDateSchema.index({ dateStr: 1, department: 1 });

export const CriticalDate = mongoose.model('CriticalDate', criticalDateSchema);
export default CriticalDate;
