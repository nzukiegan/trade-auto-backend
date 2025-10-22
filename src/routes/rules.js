import express from 'express';
import {
  createRule,
  getRules,
  getRule,
  updateRule,
  deleteRule,
  getRuleStats
} from '../controllers/ruleController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/', createRule);
router.get('/', getRules);
router.get('/stats', getRuleStats);
router.get('/:id', getRule);
router.patch('/:id', updateRule);
router.delete('/:id', deleteRule);

export default router;