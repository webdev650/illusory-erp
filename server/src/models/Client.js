import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
      maxlength: 150
    },
    companyName: {
      type: String,
      trim: true,
      maxlength: 200
    },
    contactPerson: {
      type: String,
      trim: true,
      maxlength: 120
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address']
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true
    },
    industry: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true
    },
    notes: {
      type: String,
      trim: true
    },
    logo: {
      url: String,
      publicId: String
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

clientSchema.index({ name: 'text', companyName: 'text', email: 'text' });

export default mongoose.model('Client', clientSchema);
