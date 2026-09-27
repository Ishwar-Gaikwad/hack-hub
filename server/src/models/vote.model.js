import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required'],
      index: true
    },
    voterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Voter ID is required'],
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

// Enforce one vote per voter per project within an event at the database level
voteSchema.index({ eventId: 1, projectId: 1, voterId: 1 }, { unique: true });
voteSchema.index({ eventId: 1, voterId: 1 });

const Vote = mongoose.model('Vote', voteSchema);

export default Vote;
