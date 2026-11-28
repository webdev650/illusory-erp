import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    tempPasswordExpiresAt: {
      type: Date,
      default: null, // 7-day expiration from issuance
    },
    passwordHistory: {
      type: [
        {
          passwordHash: { type: String, required: true },
          changedAt: { type: Date, default: Date.now },
        },
      ],
      select: false,
      default: [],
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    loginHistory: [
      {
        time: {
          type: Date,
          default: Date.now,
        },
        ip: {
          type: String,
          default: '',
        },
        device: {
          type: String,
          default: '',
        },
        userAgent: {
          type: String,
          default: '',
        },
      },
    ],
  },
  { timestamps: true }
);

// Method to verify password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.passwordHash);
};

// Method to verify against previous password history (last 5 passwords + current password)
userSchema.methods.checkPasswordHistory = async function (enteredPassword) {
  // Check against current active password
  if (this.passwordHash) {
    const isCurrentMatch = await bcrypt.compare(enteredPassword, this.passwordHash);
    if (isCurrentMatch) return true;
  }

  // Check against previous history entries
  if (Array.isArray(this.passwordHistory)) {
    for (const entry of this.passwordHistory) {
      if (entry.passwordHash) {
        const isMatch = await bcrypt.compare(enteredPassword, entry.passwordHash);
        if (isMatch) return true;
      }
    }
  }

  return false;
};

// Static method to hash password
userSchema.statics.hashPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const User = mongoose.model('User', userSchema);
export default User;

