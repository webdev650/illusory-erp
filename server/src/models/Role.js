import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    permissions: [
      {
        type: String,
        trim: true,
      },
    ],
    description: {
      type: String,
      default: '',
    },
    isSystem: {
      type: Boolean,
      default: false, // System roles cannot be deleted
    },
  },
  { timestamps: true }
);

export const Role = mongoose.model('Role', roleSchema);
