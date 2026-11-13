import mongoose from 'mongoose';

const assetAssignmentSchema = new mongoose.Schema(
  {
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    expectedReturnDate: {
      type: Date,
    },
    conditionAtIssue: {
      type: String,
      enum: ['new', 'good', 'fair', 'poor'],
      default: 'good',
    },
    issueNotes: {
      type: String,
      default: '',
    },
    acknowledgement: {
      accepted: {
        type: Boolean,
        default: false,
      },
      acceptedAt: {
        type: Date,
      },
    },
    returnedAt: {
      type: Date,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    conditionAtReturn: {
      type: String,
      enum: ['new', 'good', 'fair', 'poor'],
    },
    returnNotes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'returned', 'lost'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const AssetAssignment = mongoose.model('AssetAssignment', assetAssignmentSchema);
export default AssetAssignment;
