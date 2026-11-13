import mongoose from 'mongoose';

const assetRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AssetCategory',
      required: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason for asset request is required'],
      trim: true,
    },
    neededBy: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'fulfilled', 'cancelled'],
      default: 'pending',
      index: true,
    },
    approvalRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalRequest',
    },
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const AssetRequest = mongoose.model('AssetRequest', assetRequestSchema);
export default AssetRequest;
