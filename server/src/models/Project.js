import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },
    roleInProject: {
      type: String,
      default: 'Team Member',
      trim: true
    },
    allocationPercent: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    billingRatePerHour: {
      type: Number, // Stored in paise (e.g. ₹500/hr = 50000 paise)
      default: 0,
      min: 0
    }
  },
  { _id: true }
);

const milestoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    dueDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ['pending', 'done'],
      default: 'pending'
    },
    amount: {
      type: Number, // Stored in paise
      default: 0,
      min: 0
    }
  },
  { _id: true }
);

const attachmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String
    },
    size: {
      type: Number
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    projectCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: 200
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client reference is required'],
      index: true
    },
    description: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['website', 'branding', 'app', 'social_media', 'marketing', 'video', 'other'],
      default: 'website'
    },
    status: {
      type: String,
      enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
      default: 'planning',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true
    },
    startDate: {
      type: Date
    },
    dueDate: {
      type: Date,
      index: true
    },
    completedAt: {
      type: Date
    },
    projectManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Project manager is required'],
      index: true
    },
    members: [memberSchema],
    budget: {
      amount: {
        type: Number, // Stored in paise (e.g. ₹5,00,000 = 50000000 paise)
        default: 0,
        min: 0
      },
      currency: {
        type: String,
        default: 'INR'
      },
      estimatedHours: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    progressPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    milestones: [milestoneSchema],
    attachments: [attachmentSchema],
    tags: [
      {
        type: String,
        trim: true
      }
    ],
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

projectSchema.index({ name: 'text', description: 'text', tags: 'text' });
projectSchema.index({ 'members.employee': 1 });

// Auto-generate projectCode before save if not provided
projectSchema.pre('save', async function (next) {
  if (!this.projectCode) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Project').countDocuments();
    const sequence = String(count + 1).padStart(3, '0');
    this.projectCode = `PRJ-${year}-${sequence}`;
  }
  next();
});

export default mongoose.model('Project', projectSchema);
