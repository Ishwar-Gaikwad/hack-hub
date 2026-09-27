import mongoose from 'mongoose';

const scoreSchema = new mongoose.Schema(
  {
    judgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    judgeRef: {
      type: String,
      index: true
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true
    },
    projectRef: {
      type: String,
      index: true
    },
    criteria: {
      functionality: { type: Number, min: 1, max: 5, default: 3 },
      quality: { type: Number, min: 1, max: 5, default: 3 },
      innovation: { type: Number, min: 1, max: 5, default: 3 }
    },
    comment: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

scoreSchema.index({ judgeId: 1, projectId: 1 });

const Score = mongoose.model('Score', scoreSchema);
export default Score;
