import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    type: {
      type: String,
      enum: ['national', 'festival', 'optional'],
      default: 'festival',
    },
    description: { type: String, default: '' },
    year: { type: Number, required: true, index: true },
  },
  { timestamps: true }
);

holidaySchema.index({ date: 1, year: 1 });

export const Holiday = mongoose.model('Holiday', holidaySchema);
export default Holiday;

