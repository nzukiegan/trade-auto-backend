import express from 'express';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.put('/api-keys', async (req, res) => {
  try {
    const { kalshiApiKey, kalshiSecret, polymarketApiKey } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (kalshiApiKey !== undefined) user.kalshiApiKey = kalshiApiKey;
    if (kalshiSecret !== undefined) user.kalshiSecret = kalshiSecret;
    if (polymarketApiKey !== undefined) user.polymarketApiKey = polymarketApiKey;

    await user.save();

    res.json({
      message: 'API keys updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Update API keys error:', error);
    res.status(500).json({
      message: 'Error updating API keys',
      error: error.message
    });
  }
});

router.get('/portfolio', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    res.json({
      balance: user.balance,
      portfolio: {
        kalshi: { balance: 0, positions: [] },
        polymarket: { balance: 0, positions: [] }
      }
    });
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({
      message: 'Error fetching portfolio',
      error: error.message
    });
  }
});

export default router;