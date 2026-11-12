import mongoose from 'mongoose';

const checklistItemSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true
    },
    done: {
      type: Boolean,
      default: false
    }
  },
  { _id: true }
);

const taskAttachmentSchema = new mongoose.Schema(
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
    }
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    taskCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: 250
    },
    description: {
      type: String,
      trim: true
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required'],
      index: true
    },
    assignees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        index: true
      }
    ],
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Reporter reference is required'],
      index: true
    },
    status: {
      type: String,
      enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked'],
      default: 'todo',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true
    },
    type: {
      type: String,
      enum: ['task', 'bug', 'revision', 'design', 'development', 'content', 'other'],
      default: 'task'
    },
    startDate: {
      type: Date
    },
    dueDate: {
      type: Date,
      index: true
    },
    estimatedHours: {
      type: Number,
      default: 0,
      min: 0
    },
    loggedHours: {
      type: Number,
      default: 0,
      min: 0
    },
    labels: [
      {
        type: String,
        trim: true
      }
    ],
    checklist: [checklistItemSchema],
    attachments: [taskAttachmentSchema],
    parentTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
      index: true
    },
    order: {
      type: Number,
      default: 0,
      index: true
    },
    completedAt: {
      type: Date
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

taskSchema.index({ title: 'text', description: 'text', labels: 'text' });
taskSchema.index({ project: 1, status: 1, order: 1 });
taskSchema.index({ project: 1, dueDate: 1 });

taskSchema.pre('save', async function (next) {
  if (!this.taskCode) {
    const count = await mongoose.model('Task').countDocuments();
    const sequence = String(count + 1).padStart(4, '0');
    this.taskCode = `TSK-${sequence}`;
  }
  if (this.isModified('status')) {
    if (this.status === 'done' && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== 'done') {
      this.completedAt = null;
    }
  }
  next();
});

export default mongoose.model('Task', taskSchema);
