const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  betType: { type: String, enum: ['color', 'number'], required: true },
  betValue: String,
  amount: Number,
  effectiveAmount: Number,
  result: { number: Number, color: String },
  won: Boolean,
  payout: Number,
  roundNumber: Number,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bet', betSchema);
