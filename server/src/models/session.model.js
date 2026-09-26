import mongoose from 'mongoose';
import crypto from 'crypto';

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 } // Automatic MongoDB TTL expiration
    },
    isValid: {
      type: Boolean,
      default: true,
      required: true,
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

/**
 * Generate a cryptographically secure random session token
 */
export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Static method to create a new active session
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {number} [durationHours=168] Defaults to 7 days (168 hours)
 */
sessionSchema.statics.createSession = async function (userId, durationHours = 168) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

  const session = await this.create({
    userId,
    token,
    expiresAt,
    isValid: true
  });

  return session;
};

/**
 * Static method to find an active, non-expired session populated with user
 * @param {string} token
 */
sessionSchema.statics.findValidSession = async function (token) {
  if (!token) return null;

  return this.findOne({
    token,
    isValid: true,
    expiresAt: { $gt: new Date() }
  }).populate('userId');
};

/**
 * Static method to invalidate a session
 * @param {string} token
 */
sessionSchema.statics.invalidateSession = async function (token) {
  if (!token) return false;

  const result = await this.updateOne(
    { token },
    { $set: { isValid: false } }
  );

  return result.modifiedCount > 0;
};

const Session = mongoose.model('Session', sessionSchema);

export default Session;
