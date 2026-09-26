import mongoose from 'mongoose';
import crypto from 'crypto';

const invitationSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team ID is required'],
      index: true
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days expiration
    },
    isValid: {
      type: Boolean,
      default: true,
      required: true,
      index: true
    },
    usedCount: {
      type: Number,
      default: 0
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

/**
 * Generate a cryptographically secure random invitation token
 */
export function generateInviteToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Static method to create a team invitation
 */
invitationSchema.statics.createInvitation = async function (teamId, eventId, userId, expirationDays = 7) {
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);

  const invitation = await this.create({
    teamId,
    eventId,
    token,
    createdBy: userId,
    expiresAt,
    isValid: true
  });

  return invitation;
};

const Invitation = mongoose.model('Invitation', invitationSchema);

export default Invitation;
