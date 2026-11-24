import mongoose from 'mongoose';

const letterCounterSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    sequence: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

letterCounterSchema.index({ category: 1, year: 1 }, { unique: true });

export const LetterCounter = mongoose.model('LetterCounter', letterCounterSchema);
export default LetterCounter;
