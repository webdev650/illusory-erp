import mongoose from 'mongoose';

const actionItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    dueDate: { type: Date, default: null },
    completed: { type: Boolean, default: false },
    linkedTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  },
  { _id: false }
);

const oneOnOneSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    meetingDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    agenda: {
      type: String,
      default: '',
    },
    sharedNotes: {
      type: String,
      default: '',
    },
    privateNotesEmployee: {
      type: String,
      default: '', // Only visible to the employee
    },
    privateNotesManager: {
      type: String,
      default: '', // Only visible to the manager
    },
    actionItems: [actionItemSchema],
    nextMeetingDate: {
      type: Date,
      default: null,
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const OneOnOne = mongoose.model('OneOnOne', oneOnOneSchema);
export default OneOnOne;
