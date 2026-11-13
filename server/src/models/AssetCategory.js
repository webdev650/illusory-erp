import mongoose from 'mongoose';

const customFieldSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'select', 'boolean'],
      default: 'text',
    },
    options: [{ type: String }],
  },
  { _id: false }
);

const assetCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    type: {
      type: String,
      enum: ['hardware', 'software', 'furniture', 'vehicle', 'accessory', 'other'],
      default: 'hardware',
    },
    depreciationYears: { type: Number, min: 0 },
    customFields: [customFieldSchema],
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const AssetCategory = mongoose.model('AssetCategory', assetCategorySchema);
export default AssetCategory;
