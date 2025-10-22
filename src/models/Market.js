import mongoose from 'mongoose';

const MarketSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    enum: ['polymarket', 'kalshi'],
    index: true
  },
  marketId: {
    type: String,
    required: true,
    unique: true
  },
  conditionId: {
    type: String,
    default: ''
  },
  slug: {
    type: String,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    default: ''
  },
  resolutionSource: {
    type: String,
    default: ''
  },
  marketType: {
    type: String,
    default: 'normal'
  },

  outcomes: {
    type: String,
    default: ''
  },

  outcomePrices: {
    type: String,
    default: ''
  },
  image: { type: String, default: '' },
  icon: { type: String, default: '' },
  twitterCardImage: { type: String, default: '' },
  yesPrice: { type: Number, default: 0 },
  noPrice: { type: Number, default: 0 },
  spread: { type: Number, default: 0 },
  bestBid: { type: Number, default: 0 },
  bestAsk: { type: Number, default: 0 },
  lastTradePrice: { type: Number, default: 0 },
  volume: { type: Number, default: 0 },
  liquidity: { type: Number, default: 0 },
  volumeNum: { type: Number, default: 0 },
  liquidityNum: { type: Number, default: 0 },
  endDate: { type: Date },
  closedTime: { type: Date },
  createdAt: { type: Date },
  updatedAt: { type: Date },
  lastUpdated: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  closed: { type: Boolean, default: false },
  approved: { type: Boolean, default: false },
  archived: { type: Boolean, default: false },
  ready: { type: Boolean, default: false },
  funded: { type: Boolean, default: false },
  marketMakerAddress: { type: String, default: '' },
  clobTokenIds: { type: [String], default: [] },
  mailchimpTag: { type: String, default: '' },
  creator: { type: String, default: '' },
  oneDayPriceChange: { type: Number, default: 0 },
  oneHourPriceChange: { type: Number, default: 0 },
  oneWeekPriceChange: { type: Number, default: 0 },
  oneMonthPriceChange: { type: Number, default: 0 },
  oneYearPriceChange: { type: Number, default: 0 },
  fpmmLive: { type: Boolean, default: false },
  manualActivation: { type: Boolean, default: false },
  readyForCron: { type: Boolean, default: false },
  negRiskOther: { type: Boolean, default: false }
}, {
  timestamps: true
});

MarketSchema.index({ platform: 1, active: 1 });
MarketSchema.index({ category: 1 });
MarketSchema.index({ endDate: 1 });
MarketSchema.index({ title: 'text', description: 'text' });
MarketSchema.index({ slug: 1 });
MarketSchema.index({ closed: 1 });
MarketSchema.index({ approved: 1 });

MarketSchema.pre('save', function (next) {
  this.lastUpdated = new Date();
  next();
});

export default mongoose.model('Market', MarketSchema);