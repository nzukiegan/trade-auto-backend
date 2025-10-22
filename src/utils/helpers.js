import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ERROR_CODES, TRADING_LIMITS } from './constants.js';

/**
 * Generate a JWT token
 */
export const generateToken = (userId, expiresIn = '7d') => {
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET || 'fallback-secret-key-for-development',
    { expiresIn }
  );
};

/**
 * Verify a JWT token
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-for-development');
  } catch (error) {
    throw new Error('Invalid token');
  }
};

/**
 * Hash a password
 */
export const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

/**
 * Generate a random string
 */
export const generateRandomString = (length = 32) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
};

/**
 * Format currency amount
 */
export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

/**
 * Format percentage
 */
export const formatPercentage = (value, decimals = 2) => {
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Calculate probability from price
 */
export const priceToProbability = (price) => {
  return price * 100;
};

/**
 * Calculate price from probability
 */
export const probabilityToPrice = (probability) => {
  return probability / 100;
};

/**
 * Validate trading parameters
 */
export const validateTradingParams = (amount, price, orderType) => {
  const errors = [];

  if (amount < TRADING_LIMITS.MIN_ORDER_AMOUNT || amount > TRADING_LIMITS.MAX_ORDER_AMOUNT) {
    errors.push(`Amount must be between ${TRADING_LIMITS.MIN_ORDER_AMOUNT} and ${TRADING_LIMITS.MAX_ORDER_AMOUNT}`);
  }

  if (orderType === 'limit') {
    if (price < TRADING_LIMITS.MIN_ORDER_PRICE || price > TRADING_LIMITS.MAX_ORDER_PRICE) {
      errors.push(`Price must be between ${TRADING_LIMITS.MIN_ORDER_PRICE} and ${TRADING_LIMITS.MAX_ORDER_PRICE}`);
    }
  }

  return errors;
};

/**
 * Calculate order total cost
 */
export const calculateOrderTotal = (amount, price) => {
  return amount * price;
};

/**
 * Sleep/delay function
 */
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry function with exponential backoff
 */
export const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
};

/**
 * Format error response
 */
export const formatErrorResponse = (message, code = ERROR_CODES.INTERNAL_SERVER_ERROR, details = null) => {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString()
    }
  };
};

/**
 * Format success response
 */
export const formatSuccessResponse = (data, message = 'Success', metadata = null) => {
  const response = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };

  if (metadata) {
    response.metadata = metadata;
  }

  return response;
};

/**
 * Paginate array of results
 */
export const paginateResults = (results, page = 1, limit = 20) => {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  const paginatedResults = results.slice(startIndex, endIndex);
  
  return {
    data: paginatedResults,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: results.length,
      pages: Math.ceil(results.length / limit),
      hasNext: endIndex < results.length,
      hasPrev: startIndex > 0
    }
  };
};

/**
 * Generate unique ID
 */
export const generateUniqueId = (prefix = '') => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2);
  return `${prefix}${timestamp}${random}`;
};

/**
 * Sanitize user input
 */
export const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim();
  }
  return input;
};

/**
 * Validate email format
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Calculate trading performance metrics
 */
export const calculatePerformanceMetrics = (trades) => {
  const executedTrades = trades.filter(trade => trade.status === 'executed');
  
  const totalVolume = executedTrades.reduce((sum, trade) => sum + trade.amount, 0);
  const totalCost = executedTrades.reduce((sum, trade) => sum + (trade.totalCost || 0), 0);
  const successRate = executedTrades.length / trades.length;
  
  return {
    totalTrades: trades.length,
    executedTrades: executedTrades.length,
    successRate: Math.round(successRate * 100),
    totalVolume,
    averageTradeSize: totalVolume / executedTrades.length || 0,
    totalCost
  };
};

/**
 * Format date for display
 */
export const formatDate = (date, includeTime = true) => {
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  
  return new Date(date).toLocaleDateString('en-US', options);
};

/**
 * Calculate time difference in human readable format
 */
export const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1
  };
  
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
    }
  }
  
  return 'just now';
};

/**
 * Deep clone an object
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (obj instanceof Object) {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
};

/**
 * Merge objects deeply
 */
export const deepMerge = (target, source) => {
  const output = deepClone(target);
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
};

/**
 * Check if value is an object
 */
export const isObject = (item) => {
  return item && typeof item === 'object' && !Array.isArray(item);
};

/**
 * Generate cache key
 */
export const generateCacheKey = (prefix, ...params) => {
  const paramString = params.map(param => {
    if (typeof param === 'object') {
      return JSON.stringify(param);
    }
    return String(param);
  }).join(':');
  
  return `${prefix}:${paramString}`;
};

/**
 * Parse cache key
 */
export const parseCacheKey = (cacheKey) => {
  const [prefix, ...params] = cacheKey.split(':');
  return { prefix, params };
};

export default {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  generateRandomString,
  formatCurrency,
  formatPercentage,
  priceToProbability,
  probabilityToPrice,
  validateTradingParams,
  calculateOrderTotal,
  sleep,
  retryWithBackoff,
  formatErrorResponse,
  formatSuccessResponse,
  paginateResults,
  generateUniqueId,
  sanitizeInput,
  isValidEmail,
  calculatePerformanceMetrics,
  formatDate,
  timeAgo,
  deepClone,
  deepMerge,
  isObject,
  generateCacheKey,
  parseCacheKey
};