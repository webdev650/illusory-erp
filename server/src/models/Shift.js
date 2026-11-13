import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    startTime: { type: String, required: true, default: '09:30' }, // HH:mm (24hr)
    endTime: { type: String, required: true, default: '18:30' },   // HH:mm (24hr)
    graceMinutes: { type: Number, default: 15 },
    workingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5], // Monday (1) to Friday (5)
    },
    halfDayHours: { type: Number, default: 4 },
    fullDayHours: { type: Number, default: 8 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Shift = mongoose.model('Shift', shiftSchema);
export default Shift;

