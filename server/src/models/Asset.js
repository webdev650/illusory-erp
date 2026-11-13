import mongoose from 'mongoose';

const assetSchema = new mongoose.Schema(
  {
    assetTag: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Asset name is required'],
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AssetCategory',
      required: [true, 'Asset category is required'],
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      default: '',
    },
    model: {
      type: String,
      trim: true,
      default: '',
    },
    serialNumber: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    imei: {
      type: String,
      trim: true,
    },
    purchaseDate: {
      type: Date,
    },
    purchaseCost: {
      type: Number, // Integer paise (e.g. 15000000 for ₹1,50,000)
      default: 0,
      min: 0,
    },
    vendor: {
      type: String,
      trim: true,
      default: '',
    },
    invoiceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    invoiceFile: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    warrantyExpiry: {
      type: Date,
      index: true,
    },
    status: {
      type: String,
      enum: ['available', 'assigned', 'under_repair', 'lost', 'retired', 'disposed'],
      default: 'available',
      index: true,
    },
    condition: {
      type: String,
      enum: ['new', 'good', 'fair', 'poor'],
      default: 'new',
    },
    location: {
      type: String,
      trim: true,
      default: 'Studio (Bhubaneswar)',
    },
    currentAssignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },
    customValues: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    photos: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
    notes: {
      type: String,
      default: '',
    },
    qrCodeValue: {
      type: String,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save auto-generate assetTag if missing
assetSchema.pre('save', async function () {
  if (!this.assetTag) {
    const count = await mongoose.model('Asset').countDocuments();
    this.assetTag = `AST-${String(count + 1).padStart(4, '0')}`;
  }
  if (!this.qrCodeValue) {
    this.qrCodeValue = this.assetTag;
  }
});

export const Asset = mongoose.model('Asset', assetSchema);
export default Asset;
