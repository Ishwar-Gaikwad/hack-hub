import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
      index: true
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ip: {
      type: String,
      default: ''
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

auditSchema.index({ eventId: 1, createdAt: -1 });
auditSchema.index({ action: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditSchema);

export default AuditLog;
