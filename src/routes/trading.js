import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  placeOrder,
  getTrades,
  getTrade,
  cancelOrder,
  getPortfolio,
  getOrderBook,
  getMarketDepth,
  batchPlaceOrders,
  modifyOrder,
  getTradingPerformance
} from '../controllers/tradingController.js';

const router = express.Router();

// All trading routes require authentication
router.use(authenticate);

/**
 * @route POST /api/trading/order
 * @description Place a new order
 * @access Private
 * @body {String} platform - Trading platform ('kalshi' or 'polymarket')
 * @body {String} marketId - Market identifier
 * @body {String} type - Order type ('buy' or 'sell')
 * @body {String} side - Contract side ('yes' or 'no')
 * @body {Number} amount - Order amount in dollars
 * @body {Number} [price] - Limit price (optional for market orders)
 * @body {String} [orderType] - 'limit' or 'market' (default: 'limit')
 */
router.post('/order', placeOrder);

/**
 * @route POST /api/trading/orders/batch
 * @description Place multiple orders at once
 * @access Private
 * @body {Array} orders - Array of order objects
 */
router.post('/orders/batch', batchPlaceOrders);

/**
 * @route GET /api/trading/trades
 * @description Get user's trade history with pagination and filtering
 * @access Private
 * @query {String} [platform] - Filter by platform
 * @query {String} [marketId] - Filter by market ID
 * @query {String} [status] - Filter by status
 * @query {String} [type] - Filter by order type
 * @query {String} [side] - Filter by side
 * @query {Number} [page=1] - Page number
 * @query {Number} [limit=20] - Items per page
 * @query {String} [sortBy=createdAt] - Sort field
 * @query {String} [sortOrder=desc] - Sort order ('asc' or 'desc')
 */
router.get('/trades', getTrades);

/**
 * @route GET /api/trading/trades/:id
 * @description Get specific trade details
 * @access Private
 * @param {String} id - Trade ID
 */
router.get('/trades/:id', getTrade);

/**
 * @route PATCH /api/trading/orders/:id
 * @description Modify an existing order (price or amount)
 * @access Private
 * @param {String} id - Order ID
 * @body {Number} [price] - New price
 * @body {Number} [amount] - New amount
 */
router.patch('/orders/:id', modifyOrder);

/**
 * @route DELETE /api/trading/orders/:id
 * @description Cancel an order
 * @access Private
 * @param {String} id - Order ID
 */
router.delete('/orders/:id', cancelOrder);

/**
 * @route GET /api/trading/portfolio
 * @description Get user's portfolio and balance information
 * @access Private
 */
router.get('/portfolio', getPortfolio);

/**
 * @route GET /api/trading/orderbook/:marketId
 * @description Get order book for a specific market
 * @access Private
 * @param {String} marketId - Market identifier
 * @query {String} platform - Trading platform
 */
router.get('/orderbook/:marketId', getOrderBook);

/**
 * @route GET /api/trading/depth/:marketId
 * @description Get market depth for a specific market
 * @access Private
 * @param {String} marketId - Market identifier
 * @query {String} platform - Trading platform
 */
router.get('/depth/:marketId', getMarketDepth);

/**
 * @route GET /api/trading/performance
 * @description Get trading performance metrics
 * @access Private
 * @query {String} [period] - Time period ('24h', '7d', '30d', 'all')
 */
router.get('/performance', getTradingPerformance);

export default router;