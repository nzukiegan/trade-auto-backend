import express from 'express';
import {
  getMarkets,
  getMarket,
  refreshMarkets,
  getMarketCategories
} from '../controllers/marketController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(optionalAuth);

router.get('/', getMarkets);
router.get('/categories', getMarketCategories);
router.get('/:marketId', getMarket);
router.post('/refresh', refreshMarkets);

export default router;