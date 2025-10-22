import mongoose from 'mongoose';

const ConditionSchema = new mongoose.Schema({
  field: {
    type: String,
    required: true,
    enum: ['probability', 'price',  'roi']
  },
  operator: {
    type: String,
    required: true,
    enum: ['<', '>', '<=', '>=', '==', '!=']
  },
  value: {
    type: Number,
    required: true
  },
  threshold: {
    type: String,
    default: ''
  },
  cooldown: {
    type: Number,
    default: 0
  },
  outcome: {
    type: String,
    default: 'yes'
  }
});

const ActionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['buy', 'sell']
  },
  amount: {
    type: Number,
    required: true,
    min: [1, 'Amount must be at least 1']
  },
  side: {
    type: String,
    required: true
  },
  percentage: {
    type: Number,
    default: 0
  }
});

const RuleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Rule name is required'],
    trim: true,
    maxlength: [100, 'Rule name cannot exceed 100 characters']
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
  triggerType: {
    type: String,
    required: true
  },
  condition: {
    type: ConditionSchema,
    required: true
  },
  action: {
    type: ActionSchema,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastTriggered: {
    type: Date
  },
  triggerCount: {
    type: Number,
    default: 0
  },
  maxTriggers: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

RuleSchema.index({ userId: 1, isActive: 1 });
RuleSchema.index({ marketId: 1 });
RuleSchema.index({ platform: 1 });

export default mongoose.model('Rule', RuleSchema);