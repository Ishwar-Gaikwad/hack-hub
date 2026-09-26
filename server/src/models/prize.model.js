import mongoose from 'mongoose';

const prizeSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Prize name is required'],
      trim: true,
      minlength: [2, 'Prize name must be at least 2 characters']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    value: {
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

const Prize = mongoose.model('Prize', prizeSchema);

export default Prize;
