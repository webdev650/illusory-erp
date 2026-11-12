import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, default: '' },
    line2: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    country: { type: String, default: 'India' },
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    relation: { type: String, default: '' },
    phone: { type: String, required: true },
  },
  { _id: false }
);

const familySchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    relation: { type: String, default: '' },
    dob: { type: Date, default: null },
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    type: {
      type: String,
      enum: ['PROMOTION', 'TRANSFER', 'ROLE_CHANGE', 'SALARY_REVISION', 'STATUS_CHANGE', 'OTHER'],
      default: 'ROLE_CHANGE',
    },
    from: { type: String, default: '' },
    to: { type: String, default: '' },
    remarks: { type: String, default: '' },
  },
  { _id: false }
);

const educationSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ['10th', '12th', 'Diploma', 'Graduation', 'PostGraduation', 'Doctorate', 'Other'],
      default: 'Graduation',
    },
    institution: { type: String, default: '' },
    boardOrUniversity: { type: String, default: '' },
    course: { type: String, default: '' },
    yearOfPassing: { type: Number, default: null },
    percentage: { type: Number, default: null },
  },
  { _id: false }
);

const experienceSchema = new mongoose.Schema(
  {
    company: { type: String, default: '' },
    designation: { type: String, default: '' },
    from: { type: Date, default: null },
    to: { type: Date, default: null },
    lastCTC: { type: Number, default: null },
    reasonForLeaving: { type: String, default: '' },
  },
  { _id: false }
);

const certificationSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    issuer: { type: String, default: '' },
    year: { type: Number, default: null },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'OFFER_LETTER',
        'APPOINTMENT_LETTER',
        'ID_PROOF',
        'ADDRESS_PROOF',
        'RESUME',
        'EXPERIENCE_LETTER',
        'PAYSLIP',
        'EDUCATION',
        'OTHER',
      ],
      default: 'OTHER',
    },
    name: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'probation', 'notice', 'resigned', 'terminated', 'inactive'],
      default: 'active',
      index: true,
    },

    // Personal details
    personal: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      gender: {
        type: String,
        enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
        default: 'Prefer not to say',
      },
      dob: { type: Date, default: null },
      bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'],
        default: 'Unknown',
      },
      maritalStatus: {
        type: String,
        enum: ['Single', 'Married', 'Divorced', 'Widowed', 'Other'],
        default: 'Single',
      },
      phone: { type: String, required: true, trim: true },
      personalEmail: { type: String, trim: true, lowercase: true, default: '' },
      officialEmail: { type: String, required: true, unique: true, trim: true, lowercase: true },
      photo: {
        url: { type: String, default: '' },
        publicId: { type: String, default: '' },
      },
      currentAddress: addressSchema,
      permanentAddress: addressSchema,
    },

    emergencyContacts: [emergencyContactSchema],
    family: [familySchema],

    // Employment details
    employment: {
      dateOfJoining: { type: Date, default: Date.now },
      employeeType: {
        type: String,
        enum: ['Full-Time', 'Part-Time', 'Contract', 'Intern'],
        default: 'Full-Time',
      },
      department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true,
      },
      team: { type: String, default: 'General' },
      designation: { type: String, required: true, trim: true },
      reportingManager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null,
      },
      workMode: {
        type: String,
        enum: ['On-site', 'Remote', 'Hybrid'],
        default: 'On-site',
      },
      probationEndDate: { type: Date, default: null },
      confirmationDate: { type: Date, default: null },
      noticePeriodDays: { type: Number, default: 30 },
    },

    history: [historySchema],
    education: [educationSchema],
    experience: [experienceSchema],
    skills: [{ type: String, trim: true }],
    certifications: [certificationSchema],

    // Statutory: Aadhaar, PAN, UAN, ESI (Restricted / masked)
    statutory: {
      aadhaar: { type: String, default: '' },
      pan: { type: String, default: '' },
      uan: { type: String, default: '' },
      esiNumber: { type: String, default: '' },
    },

    // Bank: Restricted / masked
    bank: {
      accountHolder: { type: String, default: '' },
      bankName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifsc: { type: String, default: '' },
    },

    // Salary: Restricted to employee.readSalary
    salary: {
      ctc: { type: Number, default: 0 },
      basic: { type: Number, default: 0 },
      hra: { type: Number, default: 0 },
      allowances: { type: Number, default: 0 },
    },

    documents: [documentSchema],

    // Exit details
    exit: {
      type: {
        type: String,
        enum: ['Resignation', 'Termination', 'Retirement', 'End of Contract', 'Other', ''],
        default: '',
      },
      resignationDate: { type: Date, default: null },
      lastWorkingDay: { type: Date, default: null },
      reason: { type: String, default: '' },
      fnfStatus: {
        type: String,
        enum: ['Pending', 'Processed', 'Paid', 'N/A'],
        default: 'N/A',
      },
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
employeeSchema.virtual('fullName').get(function () {
  return `${this.personal?.firstName || ''} ${this.personal?.lastName || ''}`.trim();
});

// Auto-generate employeeId (IDS001, IDS002, ...)
employeeSchema.pre('save', async function (next) {
  if (this.isNew && !this.employeeId) {
    const lastEmployee = await mongoose
      .model('Employee')
      .findOne({}, { employeeId: 1 }, { sort: { createdAt: -1 } });

    let nextNumber = 1;
    if (lastEmployee && lastEmployee.employeeId) {
      const match = lastEmployee.employeeId.match(/\d+$/);
      if (match) {
        nextNumber = parseInt(match[0], 10) + 1;
      }
    }
    this.employeeId = `IDS${String(nextNumber).padStart(3, '0')}`;
  }
  next();
});

employeeSchema.index({ 'personal.firstName': 'text', 'personal.lastName': 'text', 'personal.officialEmail': 'text' });

export const Employee = mongoose.model('Employee', employeeSchema);
