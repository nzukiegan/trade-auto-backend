// RuleEngine.js
import Rule from '../models/Rule.js';
import Trade from '../models/Trade.js';
import User from '../models/User.js';
import Market from '../models/Market.js';
import { KalshiService } from './kalshiService.js';
import { PolymarketService } from './polymarketService.js';
import cron from 'node-cron';
import dotenv from 'dotenv';
dotenv.config();

export class RuleEngine {
  constructor(websocketService) {
    this.websocketService = websocketService;
    this.isRunning = false;
    this.marketDataCache = new Map();
  }

  start() {
    if (this.isRunning) return;
    console.log('Starting Rule Engine...');
    this.isRunning = true;

    cron.schedule('*/10 * * * * *', () => {
      this.checkAllRules();
    });

    console.log('Rule Engine started successfully');
  }

  stop() {
    this.isRunning = false;
    console.log('Rule Engine stopped');
  }

  async checkAllRules() {
    if (!this.isRunning) return;

    try {
      const activeRules = await Rule.find({ isActive: true }).populate('userId');

      for (const rule of activeRules) {
        await this.checkRule(rule);
      }
    } catch (error) {
      console.error('Error checking rules:', error);
    }
  }

  async checkRule(rule) {
    try {
      if (!rule || !rule.isActive) return;

      if (Number.isInteger(rule.maxTriggers) && rule.maxTriggers !== null && rule.triggerCount >= rule.maxTriggers) {
        rule.isActive = false;
        await rule.save();
        return;
      }

      if (rule.lastTriggered && rule.condition && Number(rule.condition.cooldown) > 0) {
        const cooldownMs = Number(rule.condition.cooldown) * 60 * 1000;
        const nextAvailable = new Date(rule.lastTriggered.getTime() + cooldownMs);
        if (new Date() < nextAvailable) {
          return;
        }
      }

      let marketData = this.marketDataCache.get(rule.marketId);
      if (!marketData) {
        marketData = await Market.findOne({ marketId: rule.marketId }).lean();
        if (!marketData) {
          return;
        }
      }
      console.log("market found for this rule")
      const currentValue = await this.getMarketValue(marketData, rule);
      if (currentValue == null) {
        return;
      }

      const targetValue = Number(rule.condition.value);

      const shouldTrigger = this.evaluateCondition(currentValue, rule.condition.operator, targetValue);
      console.log("SHould rule trigger ? ", shouldTrigger)
      if (shouldTrigger) {
        await this.executeRuleAction(rule, marketData, currentValue);
      }
    } catch (error) {
      console.error(`Error checking rule ${rule._id}:`, error);
    }
  }

  async getMarketValue(marketData, rule) {
    const cond = rule.condition || {};
    const field = cond.field;

    let outcomes = [];
    let outcomePrices = [];

    try {
      outcomes = Array.isArray(marketData.outcomes) ? marketData.outcomes : JSON.parse(marketData.outcomes || '[]');
    } catch {
      outcomes = [];
    }
    try {
      outcomePrices = Array.isArray(marketData.outcomePrices) ? marketData.outcomePrices : JSON.parse(marketData.outcomePrices || '[]');
    } catch {
      outcomePrices = [];
    }

    const outcomeName = (cond.outcome || 'yes').toString().toLowerCase();
    let idx = outcomes.findIndex(o => String(o).toLowerCase() === outcomeName);
    if (idx === -1) idx = 0;

    const getOutcomePrice = (i) => {
      const p = outcomePrices && outcomePrices[i];
      const n = Number(p);
      return isFinite(n) ? n : null;
    };

    switch (field) {
      case 'probability':
        {
          let p = getOutcomePrice(idx);
          if (p == null || !isFinite(p)) return null;
          return Number(p) * 100;
        }

      case 'price':
        {
          let p = getOutcomePrice(idx);
          if (p == null || !isFinite(p)) return null;
          return Number(p);
        }

      case 'roi':
        // ROI requires portfolio/position data which isn't part of market. If you store user positions somewhere,
        // fetch them here (e.g., from User or Portfolio collection). For now, attempt to fetch a `positions` field on user.
        // We will return null if ROI can't be computed.
        try {
          const user = await User.findById(rule.userId);
          // Assume user.positions is a map { [marketId]: { shares, costBasis } }
          const marketId = rule.marketId;
          const pos = user?.positions?.[marketId] || user?.portfolio?.positions?.[marketId];
          if (!pos) return null;
          // compute latest outcome price
          let p = getOutcomePrice(idx);
          if (p == null) {
            const fallback = (outcomeName === 'yes' || outcomes[idx] === 'yes') ? marketData.yesPrice : marketData.noPrice;
            p = Number(fallback);
          }
          if (p == null || !isFinite(p)) return null;
          const currentValue = (Number(pos.shares) || 0) * Number(p);
          const costBasis = Number(pos.costBasis) || 0;
          if (costBasis === 0) return null;
          const roi = ((currentValue - costBasis) / costBasis) * 100;
          return roi;
        } catch (err) {
          return null;
        }

      default:
        return null;
    }
  }

  evaluateCondition(currentValue, operator, targetValue) {
    const a = Number(currentValue);
    const b = Number(targetValue);
    if (!isFinite(a) || !isFinite(b)) return false;
    const tol = 1e-6;

    switch (operator) {
      case '<':
        return a < b;
      case '>':
        return a > b;
      case '<=':
        return a <= b;
      case '>=':
        return a >= b;
      case '==':
        return Math.abs(a - b) <= tol;
      case '!=':
        return Math.abs(a - b) > tol;
      default:
        return false;
    }
  }

  async executeRuleAction(rule, marketData, triggeredValue = null) {
    try {
      let ruleDoc = rule;
      if (!ruleDoc.save) {
        ruleDoc = await Rule.findById(rule._id || rule.id || rule.ruleId);
        if (!ruleDoc) {
          console.error('Rule document missing at execution time');
          return;
        }
      }

      let user = ruleDoc.userId;
      if (!user || !user.kalshiApiKey && !user.polymarketApiKey) {
        user = await User.findById(ruleDoc.userId);
        if (!user) {
          console.error(`User ${ruleDoc.userId} not found for rule ${ruleDoc._id}`);
          return;
        }
      }

      if (Number.isInteger(ruleDoc.maxTriggers) && ruleDoc.maxTriggers !== null && ruleDoc.triggerCount >= ruleDoc.maxTriggers) {
        ruleDoc.isActive = false;
        await ruleDoc.save();
        return;
      }

      let tradingService;
      if (ruleDoc.platform === 'kalshi') {
        if (process.env.KALSHI_API_KEY_ID) {
          console.error(`User ${user._id} missing Kalshi credentials`);
          return;
        }
        tradingService = new KalshiService('', '');
      } else {
        if (!process.env.POLY_API_KEY) {
          console.error(`User ${user._id} missing Polymarket API key`);
          return;
        }
        tradingService = new PolymarketService('');
      }

      const action = ruleDoc.action || {};
      const cond = ruleDoc.condition || {};
      const outcome = cond.outcome || 'yes';
      const tokenIds = Array.isArray(marketData.clobTokenIds) ? marketData.clobTokenIds : JSON.parse(marketData.clobTokenIds || '[]');
      let tokenId;
      let orderPrice = action.price;
      if (!orderPrice || !tokenId) {
        let outcomePrices = [];
        try {
          outcomePrices = Array.isArray(marketData.outcomePrices) ? marketData.outcomePrices : JSON.parse(marketData.outcomePrices || '[]');
        } catch {
          outcomePrices = [];
        }

        let outcomes = [];
        try {
          outcomes = Array.isArray(marketData.outcomes) ? marketData.outcomes : JSON.parse(marketData.outcomes || '[]');
        } catch {
          outcomes = [];
        }

        let idx = outcomes.findIndex(o => String(o).toLowerCase() === String(outcome).toLowerCase());
        if (idx === -1) idx = 0;
        tokenId = tokenIds[idx]
        const p = Number(outcomePrices[idx]);
        if (isFinite(p)) orderPrice = p;
        else {
          orderPrice = (outcome === 'yes' || outcomes[idx] === 'yes') ? marketData.yesPrice : marketData.noPrice;
        }
      }

      orderPrice = Number(orderPrice) || 0;
      let orderResult;
      console.log("Executing on platform ", marketData.platform)
      if(marketData.platform === 'kalshi'){
        orderResult = await tradingService.placeOrder(
          action.type,
          action.side.toLowerCase(),
          "limit",
          marketData.marketId,
          orderPrice,
          action.amount / orderPrice
        );
      }else {
        orderResult = await tradingService.placeOrder(
          tokenId,
          orderPrice,
          action.amount / orderPrice,
          action.type
        );
      }

      console.log("order result ", orderResult)

      const trade = new Trade({
        userId: user._id,
        ruleId: ruleDoc._id,
        platform: ruleDoc.platform,
        marketId: ruleDoc.marketId,
        type: action.type,
        side: action.side,
        amount: action.amount,
        price: orderPrice,
        totalCost: Number(action.amount) * Number(orderPrice),
        status: orderResult?.status || orderResult?.order?.status,
        platformOrderId: orderResult?.orderId || orderResult?.id || orderResult?.order?.id,
        executedAt: new Date()
      });
      await trade.save();

      ruleDoc.lastTriggered = new Date();
      ruleDoc.triggerCount = (Number(ruleDoc.triggerCount) || 0) + 1;
      if (Number.isInteger(ruleDoc.maxTriggers) && ruleDoc.maxTriggers !== null && ruleDoc.triggerCount >= ruleDoc.maxTriggers) {
        ruleDoc.isActive = false;
      }
      await ruleDoc.save();

      this.websocketService.broadcastToUser(String(user._id), {
        type: 'rule_triggered',
        ruleId: ruleDoc._id,
        ruleName: ruleDoc.name,
        tradeId: trade._id,
        marketId: ruleDoc.marketId,
        action: ruleDoc.action,
        price: orderPrice,
        timestamp: new Date()
      });

      console.log(`Rule ${ruleDoc._id} triggered successfully. Trade: ${trade._id}`);
    } catch (error) {
      console.error(`Error executing rule ${rule._id || rule.id}:`, error);

      try {
        const trade = new Trade({
          userId: rule.userId?._id || rule.userId,
          ruleId: rule._id || rule.id,
          platform: rule.platform,
          marketId: rule.marketId,
          type: rule.action?.type,
          side: rule.action?.side.toLowerCase(),
          amount: rule.action?.amount,
          price: 0,
          totalCost: 0,
          status: 'failed',
          errorMessage: error.message
        });
        await trade.save();
      } catch (err) {
        console.error('Failed to log failed trade:', err);
      }
    }
  }

  handleMarketDataUpdate(marketData) {
    if (!marketData || !marketData.marketId) return;
    this.marketDataCache.set(marketData.marketId, marketData);

    if (this.isRunning) {
      this.checkRulesForMarket(marketData.marketId);
    }
  }

  async checkRulesForMarket(marketId) {
    try {
      const rules = await Rule.find({ marketId, isActive: true }).populate('userId');
      for (const rule of rules) {
        await this.checkRule(rule);
      }
    } catch (error) {
      console.error(`Error checking rules for market ${marketId}:`, error);
    }
  }
}
