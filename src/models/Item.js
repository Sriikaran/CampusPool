const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 600 },
    category: {
      type: String,
      required: true,
      enum: ['Books', 'Electronics', 'Calculators', 'Lab Equipment', 'Other']
    },
    listingType: {
      type: String,
      required: true,
      enum: ['Sell', 'Borrow', 'Exchange']
    },
    condition: {
      type: String,
      required: true,
      enum: ['New', 'Like New', 'Good', 'Fair'],
      default: 'Good'
    },
    price: { type: Number, min: 0, default: 0 },
    ownerName: { type: String, required: true, trim: true, maxlength: 60 },
    ownerEmail: { type: String, required: true, trim: true, lowercase: true },
    ownerPhone: { type: String, required: true, trim: true, maxlength: 25, default: 'Not specified' },
    status: {
      type: String,
      enum: ['Available', 'Reserved', 'Unavailable', 'Completed'],
      default: 'Available'
    }
  },
  { timestamps: true }
);

itemSchema.index({ title: 'text', description: 'text' });
itemSchema.index({ category: 1, listingType: 1, status: 1 });

module.exports = mongoose.model('Item', itemSchema);
