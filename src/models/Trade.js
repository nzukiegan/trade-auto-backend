import mongoose from 'mongoose';

const TradeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ruleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rule',
    default: null
  },
  platform: {
    type: String,
    required: true,
    enum: ['kalshi', 'polymarket']
  },
  marketId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['buy', 'sell']
  },
  side: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  totalCost: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'executed', 'failed', 'cancelled'],
    default: 'pending'
  },
  platformOrderId: {
    type: String,
    default: null
  },
  executedAt: {
    type: Date,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

TradeSchema.index({ userId: 1, createdAt: -1 });
TradeSchema.index({ ruleId: 1 });
TradeSchema.index({ platform: 1, marketId: 1 });
TradeSchema.index({ status: 1 });

export default mongoose.model('Trade', TradeSchema);