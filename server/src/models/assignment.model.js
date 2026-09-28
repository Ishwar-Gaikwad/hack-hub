import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true
    },
    judgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Judge ID is required'],
      index: true
    },
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Track',
      default: null
    },
    projectIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    }],
    assignedAll: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
      index: true
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Compound index to quickly find active assignments
assignmentSchema.index({ eventId: 1, judgeId: 1, status: 1 });

const Assignment = mongoose.model('Assignment', assignmentSchema);

export default Assignment;
