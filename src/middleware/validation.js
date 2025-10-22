import { body, param, query, validationResult } from 'express-validator';

/**
 * Handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }

  next();
};

/**
 * Common validation rules
 */
export const commonValidations = {
  objectId: param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),

  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    
    query('sortBy')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('SortBy must be a string between 1-50 characters'),
    
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('SortOrder must be either "asc" or "desc"')
  ],

  dateRange: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
  ]
};

/**
 * Auth validation rules
 */
export const authValidation = {
  register: [
    body('username')
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores')
      .trim(),

    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),

    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
  ],

  login: [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),

    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ]
};

/**
 * Trading validation rules
 */
export const tradingValidation = {
  placeOrder: [
    body('platform')
      .isIn(['kalshi', 'polymarket'])
      .withMessage('Platform must be either "kalshi" or "polymarket"'),

    body('marketId')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Market ID is required and must be between 1-100 characters')
      .trim(),

    body('type')
      .isIn(['buy', 'sell'])
      .withMessage('Order type must be either "buy" or "sell"'),

    body('side')
      .isIn(['yes', 'no'])
      .withMessage('Side must be either "yes" or "no"'),

    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number with minimum 0.01'),

    body('price')
      .optional()
      .isFloat({ min: 0.001, max: 1.0 })
      .withMessage('Price must be between 0.001 and 1.0'),

    body('orderType')
      .optional()
      .isIn(['limit', 'market'])
      .withMessage('Order type must be either "limit" or "market"')
  ],

  batchOrders: [
    body('orders')
      .isArray({ min: 1, max: 10 })
      .withMessage('Orders must be an array with 1-10 items'),

    body('orders.*.platform')
      .isIn(['kalshi', 'polymarket'])
      .withMessage('Platform must be either "kalshi" or "polymarket"'),

    body('orders.*.marketId')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Market ID is required and must be between 1-100 characters'),

    body('orders.*.type')
      .isIn(['buy', 'sell'])
      .withMessage('Order type must be either "buy" or "sell"'),

    body('orders.*.side')
      .isIn(['yes', 'no'])
      .withMessage('Side must be either "yes" or "no"'),

    body('orders.*.amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number with minimum 0.01'),

    body('orders.*.price')
      .optional()
      .isFloat({ min: 0.001, max: 1.0 })
      .withMessage('Price must be between 0.001 and 1.0')
  ],

  modifyOrder: [
    body('price')
      .optional()
      .isFloat({ min: 0.001, max: 1.0 })
      .withMessage('Price must be between 0.001 and 1.0'),

    body('amount')
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number with minimum 0.01')
  ],

  getTrades: [
    query('platform')
      .optional()
      .isIn(['kalshi', 'polymarket'])
      .withMessage('Platform must be either "kalshi" or "polymarket"'),

    query('status')
      .optional()
      .isIn(['pending', 'executed', 'failed', 'cancelled'])
      .withMessage('Invalid status'),

    query('type')
      .optional()
      .isIn(['buy', 'sell'])
      .withMessage('Type must be either "buy" or "sell"'),

    query('side')
      .optional()
      .isIn(['yes', 'no'])
      .withMessage('Side must be either "yes" or "no"')
  ]
};

/**
 * Rule validation rules
 */
export const ruleValidation = {
  createRule: [
    body('name')
      .isLength({ min: 1, max: 100 })
      .withMessage('Rule name must be between 1 and 100 characters')
      .trim(),

    body('platform')
      .isIn(['kalshi', 'polymarket'])
      .withMessage('Platform must be either "kalshi" or "polymarket"'),

    body('marketId')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Market ID is required and must be between 1-100 characters')
      .trim(),

    body('condition.field')
      .isIn(['probability', 'price', 'volume'])
      .withMessage('Condition field must be probability, price, or volume'),

    body('condition.operator')
      .isIn(['<', '>', '<=', '>=', '==', '!='])
      .withMessage('Invalid condition operator'),

    body('condition.value')
      .isFloat()
      .withMessage('Condition value must be a number'),

    body('action.type')
      .isIn(['buy', 'sell'])
      .withMessage('Action type must be either "buy" or "sell"'),

    body('action.side')
      .isIn(['yes', 'no'])
      .withMessage('Action side must be either "yes" or "no"'),

    body('action.amount')
      .isFloat({ min: 0.01 })
      .withMessage('Action amount must be a positive number with minimum 0.01'),

    body('action.price')
      .optional()
      .isFloat({ min: 0.001, max: 1.0 })
      .withMessage('Action price must be between 0.001 and 1.0')
  ],

  updateRule: [
    body('name')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Rule name must be between 1 and 100 characters')
      .trim(),

    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean')
  ]
};

/**
 * Market validation rules
 */
export const marketValidation = {
  getMarkets: [
    query('platform')
      .optional()
      .isIn(['kalshi', 'polymarket'])
      .withMessage('Platform must be either "kalshi" or "polymarket"'),

    query('category')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1-50 characters')
      .trim(),

    query('search')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search term must be between 1-100 characters')
      .trim(),

    query('activeOnly')
      .optional()
      .isBoolean()
      .withMessage('activeOnly must be a boolean')
  ],

  refreshMarkets: [
    query('platform')
      .optional()
      .isIn(['kalshi', 'polymarket'])
      .withMessage('Platform must be either "kalshi" or "polymarket"')
  ]
};

/**
 * User validation rules
 */
export const userValidation = {
  updateApiKeys: [
    body('kalshiApiKey')
      .optional()
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Kalshi API key must be between 1-500 characters')
      .trim(),

    body('kalshiSecret')
      .optional()
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Kalshi secret must be between 1-500 characters')
      .trim(),

    body('polymarketApiKey')
      .optional()
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Polymarket API key must be between 1-500 characters')
      .trim()
  ],

  updateProfile: [
    body('username')
      .optional()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores')
      .trim(),

    body('email')
      .optional()
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail()
  ]
};

/**
 * Sanitize input data to prevent XSS
 */
export const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;

    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Basic XSS prevention - escape dangerous characters
        obj[key] = obj[key]
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;')
          .trim();
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};

/**
 * Validate file uploads
 */
export const validateFileUpload = (allowedTypes, maxSize) => {
  return (req, res, next) => {
    if (!req.file) {
      return next();
    }

    // Check file type
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
      });
    }

    // Check file size
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB`
      });
    }

    next();
  };
};