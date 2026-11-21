import mongoose from 'mongoose';

const shiftAssignmentSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ['default', 'special', 'deleted'],
      default: 'default',
      index: true,
    },
    remarks: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

shiftAssignmentSchema.index({ employee: 1, startDate: 1, endDate: 1, type: 1 });

export const ShiftAssignment = mongoose.model('ShiftAssignment', shiftAssignmentSchema);
export default ShiftAssignment;
