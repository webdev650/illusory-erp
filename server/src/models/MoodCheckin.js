import mongoose from 'mongoose';

const moodCheckinSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    mood: {
      type: String,
      enum: ['Happy', 'Good', 'Cool', 'Confused', 'Sad', 'Afraid', 'Angry', 'Frustrated'],
      required: true,
    },
    note: {
      type: String,
      maxlength: 500,
      default: '',
    },
  },
  { timestamps: true }
);

// Enforce one check-in per employee per day
moodCheckinSchema.index({ employee: 1, date: 1 }, { unique: true });

export const MoodCheckin = mongoose.model('MoodCheckin', moodCheckinSchema);
