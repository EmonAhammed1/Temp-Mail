import mongoose from 'mongoose';

const EmailSchema = new mongoose.Schema({
  to: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true, // index for fast queries by temp email address
  },
  from: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    default: '(No Subject)',
  },
  bodyHtml: {
    type: String,
    default: '',
  },
  bodyText: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Avoid compiling the model multiple times during development
export default mongoose.models.Email || mongoose.model('Email', EmailSchema);
