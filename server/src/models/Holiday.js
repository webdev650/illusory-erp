import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    type: {
      type: String,
      enum: ['national', 'festival', 'optional', 'restricted'],
      default: 'festival',
    },
    description: { type: String, default: '' },
    year: { type: Number, required: true, index: true },
    isDemo: { type: Boolean, default: false, index: true },
    isSample: { type: Boolean, default: false },
  },
  { timestamps: true }
);

holidaySchema.index({ date: 1, year: 1 });

export const Holiday = mongoose.model('Holiday', holidaySchema);
export default Holiday;

