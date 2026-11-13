import mongoose from 'mongoose';

const softwareLicenseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Software license name is required'],
      trim: true,
    },
    vendor: {
      type: String,
      required: [true, 'Vendor is required'],
      trim: true,
    },
    licenseType: {
      type: String,
      enum: ['per_user', 'per_device', 'site', 'subscription'],
      default: 'per_user',
    },
    totalSeats: {
      type: Number,
      required: [true, 'Total seats count is required'],
      min: 1,
    },
    usedSeats: {
      type: Number,
      default: 0,
      min: 0,
    },
    licenseKey: {
      type: String, // Encrypted at rest using AES
      default: '',
    },
    purchaseDate: {
      type: Date,
    },
    renewalDate: {
      type: Date,
      required: [true, 'Renewal date is required'],
      index: true,
    },
    cost: {
      type: Number, // Integer paise
      default: 0,
      min: 0,
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly', 'one_time'],
      default: 'yearly',
    },
    assignedTo: [
      {
        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Employee',
          required: true,
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ['active', 'expiring', 'expired', 'cancelled'],
      default: 'active',
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Auto-update usedSeats based on assignedTo array
softwareLicenseSchema.pre('save', function () {
  this.usedSeats = (this.assignedTo || []).length;
});

export const SoftwareLicense = mongoose.model('SoftwareLicense', softwareLicenseSchema);
export default SoftwareLicense;
