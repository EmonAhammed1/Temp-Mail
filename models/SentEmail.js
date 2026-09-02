import mongoose from 'mongoose';

const SentEmailSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  from: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  to: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  subject: {
    type: String,
    default: '(No Subject)',
  },
  bodyText: {
    type: String,
    default: '',
  },
  bodyHtml: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'failed', 'opened'],
    default: 'sent',
    index: true,
  },
  deliveryMode: {
    type: String,
    enum: ['live_smtp', 'internal', 'simulated', 'failed'],
    default: 'live_smtp',
  },
  errorMessage: {
    type: String,
    default: '',
  },
  trackingId: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
  isOpened: {
    type: Boolean,
    default: false,
    index: true,
  },
  openedAt: {
    type: Date,
    default: null,
  },
  openCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

export default mongoose.models.SentEmail || mongoose.model('SentEmail', SentEmailSchema);
