import mongoose from 'mongoose';

export const EVENT_STATUSES = ['draft', 'published', 'active', 'judging', 'voting', 'ended', 'closed'];

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
      minlength: [2, 'Event name must be at least 2 characters']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    submissionDeadline: {
      type: Date,
      required: [true, 'Submission deadline is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required']
    },
    status: {
      type: String,
      enum: {
        values: EVENT_STATUSES,
        message: 'Status must be one of: draft, published, active, judging, voting, ended, closed'
      },
      default: 'published',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    votingOpenAt: {
      type: Date,
      default: null
    },
    votingCloseAt: {
      type: Date,
      default: null
    },
    resultsPublished: {
      type: Boolean,
      default: false
    },
    resultsPublishedAt: {
      type: Date,
      default: null
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

eventSchema.index({ startDate: 1, endDate: 1 });

const Event = mongoose.model('Event', eventSchema);

export default Event;
