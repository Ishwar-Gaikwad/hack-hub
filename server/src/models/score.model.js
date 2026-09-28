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
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
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
      technicalInnovation: { type: Number, min: 1, max: 10 },
      execution: { type: Number, min: 1, max: 10 },
      design: { type: Number, min: 1, max: 10 },
      impact: { type: Number, min: 1, max: 10 },
      documentation: { type: Number, min: 1, max: 10 },
      // Backward compatibility aliases
      functionality: { type: Number, min: 1, max: 10, default: 5 },
      quality: { type: Number, min: 1, max: 10, default: 5 },
      innovation: { type: Number, min: 1, max: 10, default: 5 }
    },
    rawTotal: {
      type: Number
    },
    weightedScore: {
      type: Number
    },
    normalizedScore: {
      type: Number
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

export const RUBRIC_CRITERIA = [
  {
    id: 'technicalInnovation',
    name: 'Technical Innovation & Architecture',
    description: 'Novelty of the approach, sound architectural patterns, code quality, and self-hosted reliability.',
    weight: 0.25,
    weightLabel: '25%'
  },
  {
    id: 'execution',
    name: 'Execution & Completeness',
    description: 'Functionality, adherence to project goals, stability, and lack of critical bugs.',
    weight: 0.25,
    weightLabel: '25%'
  },
  {
    id: 'design',
    name: 'Design, Usability & Polish',
    description: 'Visual appeal, responsive interface, clarity of user flows, and accessibility.',
    weight: 0.20,
    weightLabel: '20%'
  },
  {
    id: 'impact',
    name: 'Impact & Practicality',
    description: 'Real-world problem-solving value, offline utility, and deployment feasibility.',
    weight: 0.20,
    weightLabel: '20%'
  },
  {
    id: 'documentation',
    name: 'Documentation & Demonstration',
    description: 'Clear README, architecture diagrams, data models, and video demonstration.',
    weight: 0.10,
    weightLabel: '10%'
  }
];

export function calculateWeightedScore(criteria = {}) {
  const tech = Number(criteria.technicalInnovation ?? criteria.innovation ?? 5);
  const exec = Number(criteria.execution ?? criteria.functionality ?? 5);
  const des = Number(criteria.design ?? criteria.quality ?? 5);
  const imp = Number(criteria.impact ?? (tech + exec) / 2);
  const doc = Number(criteria.documentation ?? (exec + des) / 2);

  const weighted = (tech * 2.5) + (exec * 2.5) + (des * 2.0) + (imp * 2.0) + (doc * 1.0);
  return Math.round(weighted * 10) / 10;
}

const Score = mongoose.model('Score', scoreSchema);
export default Score;
