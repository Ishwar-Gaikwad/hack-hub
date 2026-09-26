import mongoose from 'mongoose';

export const PROJECT_STATUSES = ['draft', 'submitted'];

const projectSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team ID is required'],
      index: true
    },
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Track',
      required: [true, 'Track ID is required'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
      minlength: [2, 'Project title must be at least 2 characters long']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    repositoryUrl: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: {
        values: PROJECT_STATUSES,
        message: 'Status must be either draft or submitted'
      },
      default: 'draft',
      index: true
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

// One project per team per event constraint
projectSchema.index({ eventId: 1, teamId: 1 }, { unique: true });

const Project = mongoose.model('Project', projectSchema);

export default Project;
