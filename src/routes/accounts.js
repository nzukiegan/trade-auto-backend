import express from 'express';
import {
  updateApiKeys,
  getApiKeys,
  deleteApiKeys,
  getConnectionStatus,
  getPortfolio,
  getAccountStats,
  getUserProfile,
  connectMetaMask,
  getWalletInfo,
  changePassword,
  enableTwoFactorAuth,
  verifyTwoFactorAuth,
  exportTrades,
  exportPortfolio
} from '../controllers/accountController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// API Key Management
router.post('/api-keys', updateApiKeys);
router.get('/api-keys', getApiKeys);
router.delete('/api-keys/:platform', deleteApiKeys);

// Connection Testing
router.get('/connection-status', getConnectionStatus);

// Portfolio & Account Info
router.get('/portfolio', getPortfolio);
router.get('/stats', getAccountStats);
router.get('/profile', getUserProfile);

// Wallet Management
router.post('/connect-metamask', connectMetaMask);
router.get('/wallet-info', getWalletInfo);

// Security
router.post('/change-password', changePassword);
router.post('/enable-2fa', enableTwoFactorAuth);
router.post('/verify-2fa', verifyTwoFactorAuth);

// Export Data
router.get('/export-trades', exportTrades);
router.get('/export-portfolio', exportPortfolio);

export default router;