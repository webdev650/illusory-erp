import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    startTime: { type: String, required: true, default: '10:00' }, // HH:mm (24hr)
    endTime: { type: String, required: true, default: '18:45' },   // HH:mm (24hr)
    graceMinutes: { type: Number, default: 15 },
    unpaidBreakMinutes: { type: Number, default: 60 },
    workingMinutes: { type: Number, default: 465 }, // 7.75 hrs (465 mins)
    workingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5, 6], // Monday (1) to Saturday (6), Sunday off
    },
    halfDayHours: { type: Number, default: 4 },
    fullDayHours: { type: Number, default: 7.75 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Shift = mongoose.model('Shift', shiftSchema);
export default Shift;

