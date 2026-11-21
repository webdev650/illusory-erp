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

shiftSchema.pre('save', function () {
  if (this.startTime && this.endTime) {
    const [startH, startM] = this.startTime.split(':').map(Number);
    const [endH, endM] = this.endTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (endMins <= startMins) {
      throw new Error(
        'Overnight shifts crossing midnight are not currently supported. Shift start time must be earlier than end time on the same day (planned future feature).'
      );
    }
  }
});

export const Shift = mongoose.model('Shift', shiftSchema);
export default Shift;
