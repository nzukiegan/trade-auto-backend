/**
 * Application constants and configuration
 */

// Trading Platforms
export const PLATFORMS = {
  KALSHI: 'kalshi',
  POLYMARKET: 'polymarket'
};

// Order Types
export const ORDER_TYPES = {
  MARKET: 'market',
  LIMIT: 'limit'
};

// Order Sides
export const ORDER_SIDES = {
  YES: 'yes',
  NO: 'no'
};

// Order Actions
export const ORDER_ACTIONS = {
  BUY: 'buy',
  SELL: 'sell'
};

// Trade Statuses
export const TRADE_STATUS = {
  PENDING: 'pending',
  EXECUTED: 'executed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PARTIALLY_FILLED: 'partially_filled'
};

// Rule Condition Fields
export const CONDITION_FIELDS = {
  PROBABILITY: 'probability',
  PRICE: 'price',
  VOLUME: 'volume'
};

// Rule Condition Operators
export const CONDITION_OPERATORS = {
  LESS_THAN: '<',
  GREATER_THAN: '>',
  LESS_THAN_EQUAL: '<=',
  GREATER_THAN_EQUAL: '>=',
  EQUAL: '==',
  NOT_EQUAL: '!='
};

// Market Status
export const MARKET_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SETTLED: 'settled',
  CLOSED: 'closed'
};

// Error Codes
export const ERROR_CODES = {
  // Authentication errors
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_NO_TOKEN: 'AUTH_NO_TOKEN',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  
  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Trading errors
  TRADE_INSUFFICIENT_BALANCE: 'TRADE_INSUFFICIENT_BALANCE',
  TRADE_MARKET_CLOSED: 'TRADE_MARKET_CLOSED',
  TRADE_INVALID_PRICE: 'TRADE_INVALID_PRICE',
  TRADE_ORDER_REJECTED: 'TRADE_ORDER_REJECTED',
  TRADE_API_ERROR: 'TRADE_API_ERROR',
  
  // Rule errors
  RULE_CONDITION_NOT_MET: 'RULE_CONDITION_NOT_MET',
  RULE_EXECUTION_FAILED: 'RULE_EXECUTION_FAILED',
  RULE_NOT_FOUND: 'RULE_NOT_FOUND',
  
  // Market errors
  MARKET_NOT_FOUND: 'MARKET_NOT_FOUND',
  MARKET_DATA_UNAVAILABLE: 'MARKET_DATA_UNAVAILABLE',
  
  // User errors
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_INACTIVE: 'USER_INACTIVE',
  
  // System errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
};

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// Rate Limiting
export const RATE_LIMITS = {
  AUTH: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 5
  },
  TRADING: {
    WINDOW_MS: 60 * 1000, // 1 minute
    MAX_REQUESTS: 30
  },
  API: {
    WINDOW_MS: 60 * 1000, // 1 minute
    MAX_REQUESTS: 100
  }
};

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  MARKET_DATA: 30, // 30 seconds
  ORDER_BOOK: 10, // 10 seconds
  USER_PROFILE: 300, // 5 minutes
  TRADE_HISTORY: 60, // 1 minute
  PORTFOLIO: 30 // 30 seconds
};

// WebSocket Events
export const WS_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  MARKET_DATA: 'market_data',
  TRADE_UPDATE: 'trade_update',
  RULE_TRIGGERED: 'rule_triggered',
  ORDER_UPDATE: 'order_update',
  PORTFOLIO_UPDATE: 'portfolio_update',
  ERROR: 'error'
};

// Rule Engine Constants
export const RULE_ENGINE = {
  CHECK_INTERVAL: 10000, // 10 seconds
  MAX_TRIGGERS_PER_RULE: 1000,
  BATCH_SIZE: 50
};

// Trading Limits
export const TRADING_LIMITS = {
  MIN_ORDER_AMOUNT: 0.01,
  MAX_ORDER_AMOUNT: 100000,
  MIN_ORDER_PRICE: 0.001,
  MAX_ORDER_PRICE: 1.0,
  MAX_BATCH_ORDERS: 10
};

// Environment
export const ENVIRONMENT = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test'
};

// Log Levels
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

// API Versions
export const API_VERSIONS = {
  V1: 'v1'
};

// Default Configuration
export const DEFAULTS = {
  PAGINATION: {
    PAGE: 1,
    LIMIT: 20,
    MAX_LIMIT: 100
  },
  SORT: {
    BY: 'createdAt',
    ORDER: 'desc'
  },
  CURRENCY: 'USD',
  TIMEZONE: 'UTC'
};

// Notification Types
export const NOTIFICATION_TYPES = {
  TRADE_EXECUTED: 'trade_executed',
  RULE_TRIGGERED: 'rule_triggered',
  ORDER_FILLED: 'order_filled',
  ORDER_CANCELLED: 'order_cancelled',
  PRICE_ALERT: 'price_alert',
  SYSTEM_ALERT: 'system_alert'
};

// Export all constants as a single object for easy access
export default {
  PLATFORMS,
  ORDER_TYPES,
  ORDER_SIDES,
  ORDER_ACTIONS,
  TRADE_STATUS,
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  MARKET_STATUS,
  ERROR_CODES,
  HTTP_STATUS,
  RATE_LIMITS,
  CACHE_TTL,
  WS_EVENTS,
  RULE_ENGINE,
  TRADING_LIMITS,
  ENVIRONMENT,
  LOG_LEVELS,
  API_VERSIONS,
  DEFAULTS,
  NOTIFICATION_TYPES
};