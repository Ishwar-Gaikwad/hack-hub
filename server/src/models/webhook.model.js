import mongoose from 'mongoose';

export const SUPPORTED_WEBHOOK_EVENTS = [
  'submission.created',
  'submission.updated',
  'judge.assigned',
  'judging.completed',
  'voting.started',
  'voting.closed',
  'results.published'
];

const webhookSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true
    },
    targetUrl: {
      type: String,
      required: [true, 'Target URL is required'],
      trim: true
    },
    secret: {
      type: String,
      required: [true, 'Webhook signing secret is required'],
      trim: true
    },
    subscribedEvents: {
      type: [String],
      validate: {
        validator: function (events) {
          return events.every(e => SUPPORTED_WEBHOOK_EVENTS.includes(e) || e === '*');
        },
        message: 'Invalid webhook event subscription'
      },
      default: ['*']
    },
    active: {
      type: Boolean,
      default: true
    },
    deliveryLogs: [
      {
        timestamp: { type: Date, default: Date.now },
        event: String,
        statusCode: Number,
        success: Boolean,
        error: String,
        retryCount: { type: Number, default: 0 }
      }
    ]
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

webhookSchema.index({ eventId: 1, active: 1 });

const Webhook = mongoose.model('Webhook', webhookSchema);

export default Webhook;
