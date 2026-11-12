// src/modules/hrms/Employee.model.js
// The main Employee model — the heart of the HRMS module.
// It stores every detail about an employee, organised into logical sections.
// Sensitive fields (Aadhaar, PAN, bank account) are encrypted before saving.
import mongoose from 'mongoose';
import { encrypt, decrypt } from '../../utils/encrypt.js';

// --- Sub-schemas (reusable nested documents) ---

const addressSchema = new mongoose.Schema({
  line1: String,
  line2: String,
  city: String,
  state: String,
  pincode: String,
  country: { type: String, default: 'India' },
}, { _id: false });

const emergencyContactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  relationship: String,
  mobile: String,
  email: String,
}, { _id: false });

const familyMemberSchema = new mongoose.Schema({
  name: String,
  relationship: String,
  dob: Date,
  occupation: String,
  dependant: { type: Boolean, default: false },
}, { _id: false });

const nomineeSchema = new mongoose.Schema({
  name: String,
  relationship: String,
  percentage: Number,
  dob: Date,
}, { _id: false });

const educationSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['10th', '12th', 'Diploma', 'Graduation', 'PostGraduation', 'Other'],
  },
  institution: String,
  boardOrUniversity: String,
  course: String,
  yearOfPassing: Number,
  percentage: Number,
  document: {
    url: String,
    publicId: String,
  },
});

const experienceSchema = new mongoose.Schema({
  company: String,
  designation: String,
  from: Date,
  to: Date,
  lastCTC: Number,
  reasonForLeaving: String,
  referenceContact: String,
  experienceLetter: {
    url: String,
    publicId: String,
  },
});

const certificationSchema = new mongoose.Schema({
  name: String,
  issuingOrg: String,
  issueDate: Date,
  expiryDate: Date,
  credentialId: String,
  document: { url: String, publicId: String },
});

const salaryHistorySchema = new mongoose.Schema({
  effectiveDate: Date,
  ctc: Number,
  basic: Number,
  hra: Number,
  allowances: Number,
  variable: Number,
  revisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  remarks: String,
}, { timestamps: true });

const employmentHistorySchema = new mongoose.Schema({
  date: Date,
  changeType: {
    type: String,
    enum: ['PROMOTION', 'TRANSFER', 'SALARY_REVISION', 'ROLE_CHANGE'],
  },
  from: mongoose.Schema.Types.Mixed, // Previous value
  to: mongoose.Schema.Types.Mixed,   // New value
  remarks: String,
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const documentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'OFFER_LETTER', 'APPOINTMENT_LETTER', 'ID_PROOF', 'ADDRESS_PROOF',
      'EDUCATION_CERT', 'EXPERIENCE_LETTER', 'PAN_CARD', 'AADHAAR',
      'PASSPORT', 'PHOTO', 'OTHER',
    ],
  },
  url: String,
  publicId: String,
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

// --- Main Employee Schema ---
const employeeSchema = new mongoose.Schema(
  {
    // --- Personal Information ---
    personal: {
      fullName: { type: String, required: true, trim: true },
      displayName: { type: String, trim: true },
      gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] },
      dob: Date,
      bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      },
      maritalStatus: {
        type: String,
        enum: ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'],
      },
      nationality: { type: String, default: 'Indian' },
      photo: {
        url: String,
        publicId: String,
      },
    },

    // --- Contact Information ---
    contact: {
      personalMobile: String,
      altMobile: String,
      personalEmail: { type: String, lowercase: true, trim: true },
      officialEmail: { type: String, lowercase: true, trim: true },
      currentAddress: addressSchema,
      permanentAddress: addressSchema,
    },

    // --- Emergency Contacts, Family, Nominees ---
    emergencyContacts: [emergencyContactSchema],
    family: [familyMemberSchema],
    nominees: [nomineeSchema],

    // --- Statutory (Encrypted) ---
    // These fields hold AES-encrypted values. Only privileged roles can decrypt.
    statutory: {
      aadhaar: String,     // Stored encrypted
      pan: String,         // Stored encrypted
      uan: String,
      esiNumber: String,
      passportNumber: String,
    },

    // --- Bank Details (account number encrypted) ---
    bank: {
      accountHolder: String,
      bankName: String,
      accountNumber: String, // Stored encrypted
      ifsc: String,
      bankBranch: String,
    },

    // --- Employment Details ---
    employment: {
      employeeId: { type: String, unique: true, sparse: true }, // Auto-generated: IDS001
      joiningDate: Date,
      employeeType: {
        type: String,
        enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'PROBATION'],
        default: 'FULL_TIME',
      },
      department: { type: String, trim: true },
      team: String,
      designation: { type: String, trim: true },
      reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
      workLocation: String,
      workMode: { type: String, enum: ['OFFICE', 'REMOTE', 'HYBRID'], default: 'OFFICE' },
      probationEndDate: Date,
      confirmationDate: Date,
      noticePeriodDays: { type: Number, default: 30 },
      status: {
        type: String,
        enum: ['ACTIVE', 'ON_NOTICE', 'RESIGNED', 'TERMINATED', 'ABSCONDED'],
        default: 'ACTIVE',
      },
    },

    // --- Employment History (changes log within the system) ---
    employmentHistory: [employmentHistorySchema],

    // --- Education ---
    education: [educationSchema],

    // --- Work Experience (before joining IDS) ---
    experience: [experienceSchema],

    // --- Skills & Certifications ---
    skills: [{ type: String, trim: true }],
    certifications: [certificationSchema],

    // --- Salary ---
    salary: {
      ctc: Number,
      basic: Number,
      hra: Number,
      allowances: Number,
      variable: Number,
      salaryHistory: [salaryHistorySchema],
    },

    // --- HR Documents ---
    documents: [documentSchema],

    // --- Exit Details ---
    exit: {
      exitType: {
        type: String,
        enum: ['RESIGNATION', 'TERMINATION', 'RETIREMENT', 'ABSCONDING', 'END_OF_CONTRACT'],
      },
      resignationDate: Date,
      lastWorkingDay: Date,
      reason: String,
      noticeServed: Boolean,
      exitInterviewNotes: String,
      rehireEligible: Boolean,
      fnfAmount: Number,
      fnfDate: Date,
      relievingLetterIssued: Boolean,
    },

    // --- Soft Delete ---
    // We NEVER hard-delete employees; we just mark them as deleted.
    isDeleted: { type: Boolean, default: false, select: false },
    deletedAt: { type: Date, select: false },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', select: false },

    // Reference to auth user
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// --- Auto-generate employee ID before saving ---
employeeSchema.pre('save', async function (next) {
  if (this.isNew && !this.employment?.employeeId) {
    // Count all documents (including soft-deleted) so IDs never repeat
    const count = await mongoose.model('Employee').countDocuments();
    this.employment = this.employment || {};
    this.employment.employeeId = `IDS${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

// --- Encrypt sensitive fields before saving ---
employeeSchema.pre('save', function (next) {
  if (this.isModified('statutory.aadhaar') && this.statutory?.aadhaar) {
    this.statutory.aadhaar = encrypt(this.statutory.aadhaar);
  }
  if (this.isModified('statutory.pan') && this.statutory?.pan) {
    this.statutory.pan = encrypt(this.statutory.pan);
  }
  if (this.isModified('bank.accountNumber') && this.bank?.accountNumber) {
    this.bank.accountNumber = encrypt(this.bank.accountNumber);
  }
  next();
});

// --- Index for fast searches ---
employeeSchema.index({ 'personal.fullName': 'text', 'contact.officialEmail': 1 });
employeeSchema.index({ 'employment.employeeId': 1 });
employeeSchema.index({ 'employment.department': 1 });
employeeSchema.index({ 'employment.status': 1 });
employeeSchema.index({ isDeleted: 1 });

export const Employee = mongoose.model('Employee', employeeSchema);
