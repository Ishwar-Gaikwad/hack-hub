import mongoose from 'mongoose';

const teamMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'member'],
      default: 'member',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false
  }
);

const teamSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      minlength: [2, 'Team name must be at least 2 characters long']
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    members: {
      type: [teamMemberSchema],
      default: [],
      validate: {
        validator: function (members) {
          // Prevent duplicate user IDs in the same team
          const userIds = members.map((m) => m.userId.toString());
          return new Set(userIds).size === userIds.length;
        },
        message: 'A user cannot be added to the same team more than once.'
      }
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

// Indexes
teamSchema.index({ eventId: 1, name: 1 });
teamSchema.index({ 'members.userId': 1 });

const Team = mongoose.model('Team', teamSchema);

export default Team;
