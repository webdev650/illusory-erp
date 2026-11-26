import mongoose from 'mongoose';

const peerFeedbackSchema = new mongoose.Schema(
  {
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PerformanceReview',
      required: true,
      index: true,
    },
    cycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReviewCycle',
      required: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true, // Employee being reviewed
    },
    peer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true, // Peer providing feedback
    },
    status: {
      type: String,
      enum: ['nominated', 'approved_by_manager', 'rejected_by_manager', 'submitted', 'declined'],
      default: 'nominated',
      index: true,
    },
    isAnonymous: {
      type: Boolean,
      default: true,
    },
    responses: [
      {
        question: { type: String, required: true },
        answer: { type: String, default: '' },
        rating: { type: Number, min: 1, max: 5 },
      },
    ],
    submittedAt: {
      type: Date,
      default: null,
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

peerFeedbackSchema.index({ review: 1, peer: 1 }, { unique: true });

export const PeerFeedback = mongoose.model('PeerFeedback', peerFeedbackSchema);
export default PeerFeedback;
