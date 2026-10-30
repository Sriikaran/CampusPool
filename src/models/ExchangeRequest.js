const mongoose = require('mongoose');

const exchangeRequestSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    requesterName: { type: String, required: true, trim: true, maxlength: 60 },
    requesterEmail: { type: String, required: true, trim: true, lowercase: true },
    requesterPhone: { type: String, required: true, trim: true, maxlength: 25, default: 'Not specified' },
    message: { type: String, trim: true, maxlength: 300, default: '' },
    status: {
      type: String,
      enum: ['Pending', 'Accepted', 'Declined', 'Completed', 'Returned'],
      default: 'Pending'
    }
  },
  { timestamps: true }
);

exchangeRequestSchema.index({ item: 1, requesterEmail: 1, status: 1 });

module.exports = mongoose.model('ExchangeRequest', exchangeRequestSchema);
