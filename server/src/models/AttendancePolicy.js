import mongoose from 'mongoose';

export const DEFAULT_UNVERIFIED_SETTINGS = [
  {
    key: 'graceMinutes',
    label: 'Grace Window (9:45 AM - 10:00 AM vs 10:15 AM)',
    ruleBookSection: 'Section 4.1',
    isConfirmed: false,
    notes: 'Rule Book says grace window is 9:45 to 10:00 reporting window. Setting is 0 min past 10:00 AM.',
  },
  {
    key: 'accrueDuringProbation',
    label: 'Accrue Casual & Annual Leave During Probation',
    ruleBookSection: 'Section 6.2',
    isConfirmed: false,
    notes: 'Rule Book gives 1 day/month without specifying probation exception. Default is OFF until confirmed.',
  },
  {
    key: 'minServiceFrom',
    label: 'Annual Leave 6-Month Eligibility Anchor',
    ruleBookSection: 'Section 6.4',
    isConfirmed: false,
    notes: 'Rule Book says 6 months continuous service. Default is from joining date.',
  },
  {
    key: 'partialDayDuration',
    label: 'Hourly Partial Day Leave Rules & Calculation',
    ruleBookSection: 'Section 5.3',
    isConfirmed: false,
    notes: 'Rule Book does not define hourly partial day leave. Feature flag is OFF until HR defines rules.',
  },
  {
    key: 'breakPunchingMandatory',
    label: 'Break Punching Requirement (Lunch 45m, Tea 15m)',
    ruleBookSection: 'Section 4.3',
    isConfirmed: false,
    notes: 'Fixed 60m deduction is active. Biometric break punching is informational only.',
  },
  {
    key: 'sandwichPolicyWording',
    label: 'Sandwich Policy Handling (Section 6.12.1)',
    ruleBookSection: 'Section 6.12.1',
    isConfirmed: false,
    notes: 'Wording of Section 6.12.1 is pending. Mode set to OFF / Flag for review, zero auto-deduction.',
  },
  {
    key: 'casualLeaveEncashment',
    label: 'Casual Leave Year-End Encashment vs Lapse',
    ruleBookSection: 'Section 6.3.4',
    isConfirmed: false,
    notes: 'Rule Book wording on encashment beyond carry-forward is ambiguous. Default set to Lapse.',
  },
  {
    key: 'biometricIntegration',
    label: 'Biometric Attendance Source Hardware Connection',
    ruleBookSection: 'Section 4.2',
    isConfirmed: false,
    notes: 'Biometric physical sync is not connected. Active source is Web Attendance.',
  },
  {
    key: 'lateExitThreshold',
    label: 'Departure Between 6:30 PM and 6:45 PM',
    ruleBookSection: 'Section 4.1',
    isConfirmed: false,
    notes: 'Rule Book provides no specific penalty between 6:30 PM and 6:45 PM. Treated as normal exit.',
  },
];

const attendancePolicySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: 'Default Studio Policy',
    },
    // Timings
    lateAfter: {
      type: Number,
      default: 0, // 0 minutes past shift start (10:00 AM)
    },
    lateAfterTime: {
      type: String,
      default: '10:00', // IST
    },
    graceMinutes: {
      type: Number,
      default: 0, // Default 0 min past 10:00 AM (9:45-10:00 is reporting window)
    },
    halfDayMinMinutes: {
      type: Number,
      default: 240, // 4 hours
    },
    fullDayMinMinutes: {
      type: Number,
      default: 465, // 7.75 hours (10:00 - 18:45 with 1h break)
    },
    autoCloseMissingClockOutAt: {
      type: String,
      default: '19:00', // IST
    },
    maxBackdateDays: {
      type: Number,
      default: 15,
    },
    weekOffDays: {
      type: [Number],
      default: [0], // 0 = Sunday
    },
    breakMinutes: {
      type: Number,
      default: 60,
    },
    // Late penalties
    latePenaltyMode: {
      type: String,
      enum: ['flag_for_review', 'deduct_from_leave', 'deduct_salary'],
      default: 'flag_for_review',
    },
    lateThresholds: {
      tier1_monitorMax: { type: Number, default: 2 },
      tier2_halfDayMin: { type: Number, default: 3 },
      tier2_halfDayMax: { type: Number, default: 4 },
      tier3_fullDayMin: { type: Number, default: 5 },
    },
    // Regularization
    maxRegularizationsPerMonth: {
      type: Number,
      default: 2,
    },
    // Leave accrual & eligibility
    accrualStartRule: {
      type: String,
      enum: ['from_joining_month', 'from_first_full_month', 'from_confirmation'],
      default: 'from_joining_month',
    },
    accrualProrateFirstMonth: {
      type: Boolean,
      default: true, // on/before 15th = full month, otherwise next month
    },
    accrueDuringProbation: {
      type: Boolean,
      default: false, // Default OFF ("confirm with HR")
    },
    minServiceMonths: {
      type: Number,
      default: 6, // 6 months for Annual Leave
    },
    minServiceFrom: {
      type: String,
      enum: ['joining', 'confirmation'],
      default: 'joining',
    },
    // Notice rules
    noticeRules: {
      casualLeaveHours: { type: Number, default: 24 },
      annualLeaveDays: { type: Number, default: 14 },
      sickLeaveDocConsecutiveDays: { type: Number, default: 2 },
      sickLeaveDocSubmissionHours: { type: Number, default: 48 },
    },
    // Clock boundaries
    clockCutoffs: {
      firstHalfLatestArrival: { type: String, default: '14:00' }, // 2:00 PM
      secondHalfEarliestDeparture: { type: String, default: '14:00' }, // 2:00 PM
      earlyDepartureHalfDayCutoff: { type: String, default: '18:00' }, // Leaving before 6:00 PM = Half Day
      earlyExitWindowStart: { type: String, default: '18:00' }, // 6:00 PM
      earlyExitWindowEnd: { type: String, default: '18:30' }, // 6:30 PM (recorded as Early Exit)
      normalExitWindowStart: { type: String, default: '18:30' }, // 6:30 PM - 6:45 PM normal exit
      shiftEndTime: { type: String, default: '18:45' }, // 6:45 PM
    },
    // Partial day feature flag
    partialDayEnabled: {
      type: Boolean,
      default: false, // OFF by default
    },
    // Comp off
    compOffExpiryDays: {
      type: Number,
      default: 30, // 30 days
    },
    compOffPreApprovalRequired: {
      type: Boolean,
      default: true,
    },
    // Breaks
    breakPunchingMandatory: {
      type: Boolean,
      default: false,
    },
    lunchBreak: {
      start: { type: String, default: '13:00' },
      end: { type: String, default: '13:45' },
      minutes: { type: Number, default: 45 },
    },
    teaBreak: {
      start: { type: String, default: '16:00' },
      end: { type: String, default: '17:00' },
      minutes: { type: Number, default: 15 },
    },
    // Sandwich policy
    sandwichMode: {
      type: String,
      enum: ['off', 'flag_for_hr_review', 'auto_deduct'],
      default: 'off',
    },
    sandwichExemptionNoticeDays: {
      type: Number,
      default: 30,
    },
    // Settlement & carry forward
    annualLeaveMaxCarryDays: {
      type: Number,
      default: 4,
    },
    casualLeaveForwardMode: {
      type: String,
      enum: ['lapse', 'encash'],
      default: 'lapse',
    },
    // Source & security
    attendanceSource: {
      type: String,
      enum: ['web', 'biometric_import'],
      default: 'web',
    },
    creditFullHoursAutomatically: {
      type: Boolean,
      default: true,
    },
    attendanceLockedUpToDate: {
      type: Date,
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: true,
    },
    // Rule Book Section 12 items verification state
    unverifiedSettings: [
      {
        key: { type: String, required: true },
        label: { type: String, required: true },
        ruleBookSection: { type: String, default: 'Section 12' },
        isConfirmed: { type: Boolean, default: false },
        confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        confirmedAt: { type: Date, default: null },
        notes: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);

export const AttendancePolicy = mongoose.model('AttendancePolicy', attendancePolicySchema);
export default AttendancePolicy;
