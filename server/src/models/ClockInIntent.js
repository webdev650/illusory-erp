import mongoose from 'mongoose';

const clockInIntentSchema = new mongoose.Schema(
  {
    intentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD (Asia/Kolkata)
      required: true,
      index: true,
    },
    serverTime: {
      type: Date, // Exact server timestamp of first button press
      required: true,
    },
    lateMinutes: {
      type: Number,
      default: 0,
    },
    ip: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    device: {
      type: String,
      default: '',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL Index: automatically purged upon expiration
    },
  },
  { timestamps: true }
);

export const ClockInIntent = mongoose.model('ClockInIntent', clockInIntentSchema);
export default ClockInIntent;
