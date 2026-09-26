import mongoose from 'mongoose';

const trackSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required']
    },
    name: {
      type: String,
      required: [true, 'Track name is required'],
      trim: true,
      minlength: [2, 'Track name must be at least 2 characters']
    },
    description: {
      type: String,
      trim: true,
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

trackSchema.index({ eventId: 1, name: 1 }, { unique: true });

const Track = mongoose.model('Track', trackSchema);

export default Track;
