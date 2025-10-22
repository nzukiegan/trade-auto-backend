import Trade from '../models/Trade.js';
import User from '../models/User.js';
import { KalshiService } from '../services/kalshiService.js';
import { PolymarketService } from '../services/polymarketService.js';

/**
 * Place a new order
 */
export const placeOrder = async (req, res) => {
  try {
    const { platform, marketId, type, side, amount, price, orderType = 'limit' } = req.body;

    // Input validation
    if (!['kalshi', 'polymarket'].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid platform. Must be "kalshi" or "polymarket"'
      });
    }

    if (!['buy', 'sell'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order type. Must be "buy" or "sell"'
      });
    }

    if (!['yes', 'no'].includes(side)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid side. Must be "yes" or "no"'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    if (orderType === 'limit' && (!price || price <= 0 || price > 1)) {
      return res.status(400).json({
        success: false,
        message: 'Limit orders require a valid price between 0 and 1'
      });
    }

    // Get user with API keys
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let tradingService;
    if (platform === 'kalshi') {
      if (!user.kalshiApiKey || !user.kalshiSecret) {
        return res.status(400).json({
          success: false,
          message: 'Kalshi API credentials not configured'
        });
      }
      tradingService = new KalshiService(user.kalshiApiKey, user.kalshiSecret);
    } else {
      if (!user.polymarketApiKey) {
        return res.status(400).json({
          success: false,
          message: 'Polymarket API key not configured'
        });
      }
      tradingService = new PolymarketService(user.polymarketApiKey);
    }

    // Create trade record
    const trade = new Trade({
      userId: req.userId,
      platform,
      marketId,
      type,
      side,
      amount,
      price: orderType === 'limit' ? price : null,
      totalCost: amount * (price || 0),
      status: 'pending',
      orderType
    });

    await trade.save();

    try {
      // Execute trade on platform
      const orderResult = await tradingService.placeOrder(
        marketId,
        side,
        orderType === 'limit' ? price : null,
        amount,
        type
      );

      // Update trade record with platform response
      trade.platformOrderId = orderResult.orderId;
      trade.status = orderResult.status === 'filled' ? 'executed' : 'pending';
      trade.executedAt = orderResult.executedAt || new Date();
      trade.platformData = orderResult; // Store full platform response
      
      await trade.save();

      res.json({
        success: true,
        message: 'Order placed successfully',
        trade: await trade.populate('userId', 'username email'),
        platformResponse: orderResult
      });

    } catch (platformError) {
      // Update trade record with error
      trade.status = 'failed';
      trade.errorMessage = platformError.message;
      trade.platformData = { error: platformError.message };
      await trade.save();

      console.error(`Platform trading error for user ${req.userId}:`, platformError);
      
      res.status(500).json({
        success: false,
        message: 'Trade execution failed on platform',
        error: platformError.message,
        trade: await trade.populate('userId', 'username email')
      });
    }

  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error placing order',
      error: error.message
    });
  }
};

/**
 * Place multiple orders in batch
 */
export const batchPlaceOrders = async (req, res) => {
  try {
    const { orders } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Orders array is required and cannot be empty'
      });
    }

    if (orders.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 orders allowed per batch'
      });
    }

    const results = [];
    const user = await User.findById(req.userId);

    for (const orderData of orders) {
      try {
        const { platform, marketId, type, side, amount, price, orderType = 'limit' } = orderData;

        // Validate individual order
        if (!platform || !marketId || !type || !side || !amount) {
          results.push({
            success: false,
            message: 'Missing required fields',
            order: orderData
          });
          continue;
        }

        let tradingService;
        if (platform === 'kalshi') {
          if (!user.kalshiApiKey || !user.kalshiSecret) {
            results.push({
              success: false,
              message: 'Kalshi API credentials not configured',
              order: orderData
            });
            continue;
          }
          tradingService = new KalshiService(user.kalshiApiKey, user.kalshiSecret);
        } else {
          if (!user.polymarketApiKey) {
            results.push({
              success: false,
              message: 'Polymarket API key not configured',
              order: orderData
            });
            continue;
          }
          tradingService = new PolymarketService(user.polymarketApiKey);
        }

        // Create trade record
        const trade = new Trade({
          userId: req.userId,
          platform,
          marketId,
          type,
          side,
          amount,
          price: orderType === 'limit' ? price : null,
          totalCost: amount * (price || 0),
          status: 'pending',
          orderType,
          batchId: req.body.batchId || `batch_${Date.now()}`
        });

        await trade.save();

        // Execute order
        const orderResult = await tradingService.placeOrder(
          marketId,
          side,
          orderType === 'limit' ? price : null,
          amount,
          type
        );

        // Update trade record
        trade.platformOrderId = orderResult.orderId;
        trade.status = orderResult.status === 'filled' ? 'executed' : 'pending';
        trade.executedAt = orderResult.executedAt || new Date();
        trade.platformData = orderResult;
        await trade.save();

        results.push({
          success: true,
          message: 'Order placed successfully',
          tradeId: trade._id,
          platformResponse: orderResult
        });

      } catch (orderError) {
        results.push({
          success: false,
          message: `Order failed: ${orderError.message}`,
          order: orderData,
          error: orderError.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Batch order processing completed',
      results,
      summary: {
        total: orders.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });

  } catch (error) {
    console.error('Batch place orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing batch orders',
      error: error.message
    });
  }
};

/**
 * Get user's trade history with advanced filtering
 */
export const getTrades = async (req, res) => {
  try {
    const {
      platform,
      marketId,
      status,
      type,
      side,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate,
      endDate
    } = req.query;

    const filter = { userId: req.userId };
    
    // Apply filters
    if (platform) filter.platform = platform;
    if (marketId) filter.marketId = marketId;
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (side) filter.side = side;

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const trades = await Trade.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('ruleId', 'name condition action')
      .populate('userId', 'username email')
      .lean();

    const total = await Trade.countDocuments(filter);

    // Calculate performance metrics
    const performance = await Trade.aggregate([
      { $match: { ...filter, status: 'executed' } },
      {
        $group: {
          _id: null,
          totalVolume: { $sum: '$amount' },
          totalTrades: { $sum: 1 },
          avgTradeSize: { $avg: '$amount' },
          successfulTrades: {
            $sum: { $cond: [{ $eq: ['$status', 'executed'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      trades,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      performance: performance[0] || {
        totalVolume: 0,
        totalTrades: 0,
        avgTradeSize: 0,
        successfulTrades: 0
      },
      filters: {
        platform,
        marketId,
        status,
        type,
        side,
        startDate,
        endDate
      }
    });

  } catch (error) {
    console.error('Get trades error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trades',
      error: error.message
    });
  }
};

/**
 * Get specific trade details
 */
export const getTrade = async (req, res) => {
  try {
    const trade = await Trade.findOne({
      _id: req.params.id,
      userId: req.userId
    })
      .populate('ruleId', 'name condition action')
      .populate('userId', 'username email');

    if (!trade) {
      return res.status(404).json({
        success: false,
        message: 'Trade not found'
      });
    }

    res.json({
      success: true,
      trade
    });

  } catch (error) {
    console.error('Get trade error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trade',
      error: error.message
    });
  }
};

/**
 * Modify an existing order
 */
export const modifyOrder = async (req, res) => {
  try {
    const { price, amount } = req.body;
    const tradeId = req.params.id;

    if (!price && !amount) {
      return res.status(400).json({
        success: false,
        message: 'Either price or amount must be provided for modification'
      });
    }

    const trade = await Trade.findOne({
      _id: tradeId,
      userId: req.userId,
      status: 'pending'
    });

    if (!trade) {
      return res.status(404).json({
        success: false,
        message: 'Pending trade not found'
      });
    }

    // Get user with API keys
    const user = await User.findById(req.userId);
    let tradingService;

    if (trade.platform === 'kalshi') {
      tradingService = new KalshiService(user.kalshiApiKey, user.kalshiSecret);
    } else {
      tradingService = new PolymarketService(user.polymarketApiKey);
    }

    // Cancel existing order
    if (trade.platformOrderId) {
      await tradingService.cancelOrder(trade.platformOrderId);
    }

    // Place new order with updated parameters
    const newPrice = price !== undefined ? price : trade.price;
    const newAmount = amount !== undefined ? amount : trade.amount;

    const orderResult = await tradingService.placeOrder(
      trade.marketId,
      trade.side,
      newPrice,
      newAmount,
      trade.type
    );

    // Update trade record
    trade.price = newPrice;
    trade.amount = newAmount;
    trade.totalCost = newAmount * newPrice;
    trade.platformOrderId = orderResult.orderId;
    trade.platformData = orderResult;
    trade.updatedAt = new Date();

    await trade.save();

    res.json({
      success: true,
      message: 'Order modified successfully',
      trade: await trade.populate('userId', 'username email'),
      platformResponse: orderResult
    });

  } catch (error) {
    console.error('Modify order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error modifying order',
      error: error.message
    });
  }
};

/**
 * Cancel an order
 */
export const cancelOrder = async (req, res) => {
  try {
    const trade = await Trade.findOne({
      _id: req.params.id,
      userId: req.userId,
      status: 'pending'
    });

    if (!trade) {
      return res.status(404).json({
        success: false,
        message: 'Pending trade not found'
      });
    }

    // Get user with API keys
    const user = await User.findById(req.userId);
    let tradingService;

    if (trade.platform === 'kalshi') {
      tradingService = new KalshiService(user.kalshiApiKey, user.kalshiSecret);
    } else {
      tradingService = new PolymarketService(user.polymarketApiKey);
    }

    // Cancel order on platform
    if (trade.platformOrderId) {
      await tradingService.cancelOrder(trade.platformOrderId);
    }

    // Update trade status
    trade.status = 'cancelled';
    trade.cancelledAt = new Date();
    await trade.save();

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      trade: await trade.populate('userId', 'username email')
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling order',
      error: error.message
    });
  }
};

/**
 * Get user's portfolio and balance information
 */
export const getPortfolio = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    // Get portfolio from both platforms
    let kalshiPortfolio = { balance: 0, positions: [] };
    let polymarketPortfolio = { balance: 0, positions: [] };

    try {
      if (user.kalshiApiKey && user.kalshiSecret) {
        const kalshiService = new KalshiService(user.kalshiApiKey, user.kalshiSecret);
        kalshiPortfolio = await kalshiService.getPortfolio();
      }
    } catch (kalshiError) {
      console.error('Kalshi portfolio error:', kalshiError);
    }

    try {
      if (user.polymarketApiKey) {
        const polymarketService = new PolymarketService(user.polymarketApiKey);
        polymarketPortfolio = await polymarketService.getPortfolio();
      }
    } catch (polymarketError) {
      console.error('Polymarket portfolio error:', polymarketError);
    }

    // Calculate total balance
    const totalBalance = kalshiPortfolio.balance + polymarketPortfolio.balance;

    // Get recent trading activity
    const recentTrades = await Trade.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('ruleId', 'name')
      .lean();

    res.json({
      success: true,
      portfolio: {
        totalBalance,
        kalshi: kalshiPortfolio,
        polymarket: polymarketPortfolio
      },
      recentTrades,
      summary: {
        totalTrades: await Trade.countDocuments({ userId: req.userId }),
        activePositions: [...kalshiPortfolio.positions, ...polymarketPortfolio.positions].length,
        totalVolume: await Trade.aggregate([
          { $match: { userId: req.userId, status: 'executed' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).then(result => result[0]?.total || 0)
      }
    });

  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching portfolio',
      error: error.message
    });
  }
};

/**
 * Get order book for a specific market
 */
export const getOrderBook = async (req, res) => {
  try {
    const { marketId } = req.params;
    const { platform } = req.query;

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: 'Platform query parameter is required'
      });
    }

    const user = await User.findById(req.userId);
    let tradingService;

    if (platform === 'kalshi') {
      if (!user.kalshiApiKey || !user.kalshiSecret) {
        return res.status(400).json({
          success: false,
          message: 'Kalshi API credentials not configured'
        });
      }
      tradingService = new KalshiService(user.kalshiApiKey, user.kalshiSecret);
    } else {
      if (!user.polymarketApiKey) {
        return res.status(400).json({
          success: false,
          message: 'Polymarket API key not configured'
        });
      }
      tradingService = new PolymarketService(user.polymarketApiKey);
    }

    const orderBook = await tradingService.getOrderBook(marketId);

    res.json({
      success: true,
      marketId,
      platform,
      orderBook,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Get order book error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order book',
      error: error.message
    });
  }
};

/**
 * Get market depth for a specific market
 */
export const getMarketDepth = async (req, res) => {
  try {
    const { marketId } = req.params;
    const { platform } = req.query;

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: 'Platform query parameter is required'
      });
    }

    const user = await User.findById(req.userId);
    let tradingService;

    if (platform === 'kalshi') {
      if (!user.kalshiApiKey || !user.kalshiSecret) {
        return res.status(400).json({
          success: false,
          message: 'Kalshi API credentials not configured'
        });
      }
      tradingService = new KalshiService(user.kalshiApiKey, user.kalshiSecret);
    } else {
      if (!user.polymarketApiKey) {
        return res.status(400).json({
          success: false,
          message: 'Polymarket API key not configured'
        });
      }
      tradingService = new PolymarketService(user.polymarketApiKey);
    }

    const marketDepth = await tradingService.getMarketDepth(marketId);

    res.json({
      success: true,
      marketId,
      platform,
      marketDepth,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Get market depth error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching market depth',
      error: error.message
    });
  }
};

/**
 * Get trading performance metrics
 */
export const getTradingPerformance = async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    
    // Calculate date range based on period
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case '24h':
        dateFilter = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
        break;
      case '7d':
        dateFilter = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case '30d':
        dateFilter = { createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
        break;
      // 'all' includes all trades
    }

    const filter = { userId: req.userId, ...dateFilter };

    // Performance metrics aggregation
    const performance = await Trade.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          executedTrades: {
            $sum: { $cond: [{ $eq: ['$status', 'executed'] }, 1, 0] }
          },
          failedTrades: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          pendingTrades: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          totalVolume: { $sum: '$amount' },
          totalCost: { $sum: '$totalCost' },
          avgTradeSize: { $avg: '$amount' },
          successRate: {
            $avg: { $cond: [{ $eq: ['$status', 'executed'] }, 1, 0] }
          }
        }
      }
    ]);

    // Platform-wise breakdown
    const platformBreakdown = await Trade.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 },
          volume: { $sum: '$amount' },
          successRate: {
            $avg: { $cond: [{ $eq: ['$status', 'executed'] }, 1, 0] }
          }
        }
      }
    ]);

    // Recent performance trend (last 7 days)
    const trendData = await Trade.aggregate([
      {
        $match: {
          userId: req.userId,
          createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          dailyTrades: { $sum: 1 },
          dailyVolume: { $sum: '$amount' },
          successfulTrades: {
            $sum: { $cond: [{ $eq: ['$status', 'executed'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const metrics = performance[0] || {
      totalTrades: 0,
      executedTrades: 0,
      failedTrades: 0,
      pendingTrades: 0,
      totalVolume: 0,
      totalCost: 0,
      avgTradeSize: 0,
      successRate: 0
    };

    res.json({
      success: true,
      performance: {
        ...metrics,
        successRate: Math.round(metrics.successRate * 100)
      },
      platformBreakdown,
      trend: trendData,
      period,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Get trading performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trading performance',
      error: error.message
    });
  }
};