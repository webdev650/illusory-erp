import mongoose from 'mongoose';

const taskCommentSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: [true, 'Task reference is required'],
      index: true
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
      index: true
    },
    body: {
      type: String,
      required: [true, 'Comment body is required'],
      trim: true
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
      }
    ],
    attachments: [
      {
        name: String,
        url: String,
        publicId: String
      }
    ],
    editedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('TaskComment', taskCommentSchema);
