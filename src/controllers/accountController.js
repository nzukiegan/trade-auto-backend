import User from '../models/User.js';
import Trade from '../models/Trade.js';
import Rule from '../models/Rule.js';
import { PolymarketService } from '../services/polymarketService.js';
import { KalshiService } from '../services/kalshiService.js';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { Parser } from 'json2csv';

const poly = new PolymarketService();
const kalsh = new KalshiService();

const updateApiKeys = async (req, res) => {
  try {
    const { platform, keys } = req.body;
    const userId = req.userId;

    if (!platform || !keys) {
      return res.status(400).json({
        success: false,
        message: 'Platform and keys are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.apiKeys) {
      user.apiKeys = {};
    }

    user.apiKeys[platform] = {
      ...keys,
      updatedAt: new Date(),
      isActive: true
    };

    await user.save();

    res.json({
      success: true,
      message: `${platform.charAt(0).toUpperCase() + platform.slice(1)} API keys updated successfully`,
      connectionTest
    });

  } catch (error) {
    console.error('Update API keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating API keys',
      error: error.message
    });
  }
};

const getApiKeys = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('apiKeys');
    
    if (!user || !user.apiKeys) {
      return res.json({
        success: true,
        apiKeys: {}
      });
    }

    const maskedKeys = {};
    Object.keys(user.apiKeys).forEach(platform => {
      const keys = user.apiKeys[platform];
      maskedKeys[platform] = {
        isConfigured: !!keys,
        isActive: keys?.isActive || false,
        lastUpdated: keys?.updatedAt,
        apiKey: keys?.apiKey ? `${keys.apiKey.substring(0, 8)}...` : null,
        walletAddress: keys?.walletKey ? `${keys.walletKey.substring(0, 8)}...${keys.walletKey.substring(keys.walletKey.length - 6)}` : null
      };
    });

    res.json({
      success: true,
      apiKeys: maskedKeys
    });

  } catch (error) {
    console.error('Get API keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching API keys',
      error: error.message
    });
  }
};

const deleteApiKeys = async (req, res) => {
  try {
    const { platform } = req.params;
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user || !user.apiKeys || !user.apiKeys[platform]) {
      return res.status(404).json({
        success: false,
        message: 'No API keys found for this platform'
      });
    }

    delete user.apiKeys[platform];
    await user.save();

    res.json({
      success: true,
      message: `${platform.charAt(0).toUpperCase() + platform.slice(1)} API keys removed successfully`
    });

  } catch (error) {
    console.error('Delete API keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting API keys',
      error: error.message
    });
  }
};

const getConnectionStatus = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const status = {};

    if (user?.apiKeys) {
      for (const platform of Object.keys(user.apiKeys)) {
        const keys = user.apiKeys[platform];
        status[platform] = {
          configured: true,
          isActive: keys.isActive || false,
          lastTested: keys.lastTested,
          lastUpdated: keys.updatedAt
        };
      }
    }

    ['kalshi', 'polymarket'].forEach(platform => {
      if (!status[platform]) {
        status[platform] = {
          configured: false,
          isActive: false,
          lastTested: null,
          lastUpdated: null
        };
      }
    });

    res.json({
      success: true,
      connectionStatus: status
    });

  } catch (error) {
    console.error('Get connection status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching connection status',
      error: error.message
    });
  }
};

const getPortfolio = async (req, res) => {
  try {
    const userId = req.userId;
    
    const [kalshiPortfolio, polymarketPortfolio] = await Promise.allSettled([
      kalsh.getPortfolio(userId),
      poly.getPortfolio(userId)
    ]);

    const portfolio = {
      totalBalance: 0,
      platforms: {
        kalshi: kalshiPortfolio.status === 'fulfilled' ? kalshiPortfolio.value : { balance: 0, error: 'Failed to fetch' },
        polymarket: polymarketPortfolio.status === 'fulfilled' ? polymarketPortfolio.value : { balance: 0, error: 'Failed to fetch' }
      }
    };

    portfolio.totalBalance = 
      (portfolio.platforms.kalshi.balance || 0) + 
      (portfolio.platforms.polymarket.balance || 0);

    const recentTrades = await Trade.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('marketId', 'title')
      .lean();

    res.json({
      success: true,
      portfolio,
      recentTrades
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

const getAccountStats = async (req, res) => {
  try {
    const userId = req.userId;

    const [
      totalTrades,
      activeRules,
      totalVolume,
      successfulTrades
    ] = await Promise.all([
      Trade.countDocuments({ userId }),
      
      Rule.countDocuments({ userId, isActive: true }),
      
      Trade.aggregate([
        { $match: { userId, status: 'executed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      Trade.countDocuments({ userId, status: 'executed' })
    ]);

    const stats = {
      totalTrades,
      activeRules,
      totalVolume: totalVolume[0]?.total || 0,
      successfulTrades,
      successRate: totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get account stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching account statistics',
      error: error.message
    });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('-password -apiKeys');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      profile: {
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        isVerified: user.isVerified,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      error: error.message
    });
  }
};

const connectMetaMask = async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    const user = await User.findById(req.userId);
    
    if (!user.connectedWallets) {
      user.connectedWallets = [];
    }

    const existingWallet = user.connectedWallets.find(
      wallet => wallet.address.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!existingWallet) {
      user.connectedWallets.push({
        address: walletAddress,
        connectedAt: new Date(),
        platform: 'metamask'
      });
    }

    await user.save();

    res.json({
      success: true,
      message: 'MetaMask wallet connected successfully',
      walletAddress
    });

  } catch (error) {
    console.error('Connect MetaMask error:', error);
    res.status(500).json({
      success: false,
      message: 'Error connecting MetaMask wallet',
      error: error.message
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    const user = await User.findById(req.userId);
    
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
};

const enableTwoFactorAuth = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    const secret = speakeasy.generateSecret({
      name: `TradingApp (${user.email})`
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    user.twoFactorTempSecret = secret.base32;
    await user.save();

    res.json({
      success: true,
      secret: secret.base32,
      qrCodeUrl,
      message: 'Scan the QR code with your authenticator app'
    });

  } catch (error) {
    console.error('Enable 2FA error:', error);
    res.status(500).json({
      success: false,
      message: 'Error enabling two-factor authentication',
      error: error.message
    });
  }
};

const verifyTwoFactorAuth = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    const user = await User.findById(req.userId);

    if (!user.twoFactorTempSecret) {
      return res.status(400).json({
        success: false,
        message: 'Two-factor setup not initiated'
      });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorTempSecret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    user.twoFactorSecret = user.twoFactorTempSecret;
    user.twoFactorEnabled = true;
    user.twoFactorTempSecret = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Two-factor authentication enabled successfully'
    });

  } catch (error) {
    console.error('Verify 2FA error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying two-factor authentication',
      error: error.message
    });
  }
};

const exportTrades = async (req, res) => {
  try {
    const { format = 'csv', startDate, endDate } = req.query;
    const userId = req.userId;

    let filter = { userId };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const trades = await Trade.find(filter)
      .populate('marketId', 'title')
      .populate('ruleId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    if (format === 'csv') {
      const fields = [
        'createdAt',
        'platform',
        'marketId.title',
        'side',
        'amount',
        'price',
        'status',
        'type',
        'ruleId.name'
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(trades);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=trades-${Date.now()}.csv`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        trades,
        count: trades.length
      });
    }

  } catch (error) {
    console.error('Export trades error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting trades',
      error: error.message
    });
  }
};

const exportPortfolio = async (req, res) => {
  try {
    const userId = req.userId;

    const portfolioData = await getPortfolioData(userId);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=portfolio-${Date.now()}.json`);
    res.send(JSON.stringify(portfolioData, null, 2));

  } catch (error) {
    console.error('Export portfolio error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting portfolio',
      error: error.message
    });
  }
};

async function getPortfolioData(userId) {
  const [
    trades,
    rules,
    portfolio
  ] = await Promise.all([
    Trade.find({ userId }).populate('marketId', 'title').lean(),
    Rule.find({ userId }).lean(),
    getPortfolio(userId)
  ]);

  return {
    exportDate: new Date(),
    trades,
    rules,
    portfolio,
    summary: {
      totalTrades: trades.length,
      activeRules: rules.filter(rule => rule.isActive).length,
      totalVolume: trades.reduce((sum, trade) => sum + (trade.amount || 0), 0)
    }
  };
}

/**
 * Get comprehensive wallet information and blockchain data
 */
const getWalletInfo = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get wallet information from database
    const walletInfo = {
      connectedWallets: user.connectedWallets || [],
      apiKeys: await getApiKeyWalletInfo(user),
      blockchainData: await getBlockchainWalletData(user),
      portfolioValue: await getWalletPortfolioValue(userId),
      transactionHistory: await getWalletTransactionHistory(userId),
      security: await getWalletSecurityInfo(user)
    };

    // Enhance with real-time blockchain data
    await enhanceWithBlockchainData(walletInfo);

    res.json({
      success: true,
      walletInfo,
      summary: {
        totalWallets: walletInfo.connectedWallets.length,
        totalValue: walletInfo.portfolioValue.totalValue,
        activePlatforms: Object.keys(walletInfo.apiKeys).filter(platform => 
          walletInfo.apiKeys[platform].isConfigured
        ).length
      }
    });

  } catch (error) {
    console.error('Get wallet info error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching wallet information',
      error: error.message
    });
  }
};

// Helper function to get API key wallet information
async function getApiKeyWalletInfo(user) {
  const walletInfo = {};
  
  if (user.apiKeys) {
    if (user.apiKeys.kalshi) {
      try {
        const kalshiBalance = await kalsh.getBalance(user.apiKeys.kalshi);
        walletInfo.kalshi = {
          isConfigured: true,
          isActive: user.apiKeys.kalshi.isActive || false,
          balance: kalshiBalance,
          currency: 'USD',
          lastUpdated: new Date(),
          accountType: 'Exchange Account'
        };
      } catch (error) {
        walletInfo.kalshi = {
          isConfigured: true,
          isActive: false,
          balance: 0,
          error: error.message,
          lastUpdated: new Date()
        };
      }
    } else {
      walletInfo.kalshi = {
        isConfigured: false,
        isActive: false,
        balance: 0
      };
    }

    // Polymarket wallet info
    if (user.apiKeys.polymarket && user.apiKeys.polymarket.walletKey) {
      try {
        const polyBalance = await poly.getWalletBalance(user.apiKeys.polymarket.walletKey);
        walletInfo.polymarket = {
          isConfigured: true,
          isActive: user.apiKeys.polymarket.isActive || false,
          walletAddress: maskAddress(user.apiKeys.polymarket.walletKey),
          balance: polyBalance.balance,
          maticBalance: polyBalance.maticBalance,
          currency: 'USD',
          lastUpdated: new Date(),
          accountType: 'Web3 Wallet',
          network: 'Polygon'
        };
      } catch (error) {
        walletInfo.polymarket = {
          isConfigured: true,
          isActive: false,
          walletAddress: maskAddress(user.apiKeys.polymarket.walletKey),
          balance: 0,
          error: error.message,
          lastUpdated: new Date()
        };
      }
    } else {
      walletInfo.polymarket = {
        isConfigured: false,
        isActive: false,
        balance: 0
      };
    }
  }

  return walletInfo;
}

// Helper function to get blockchain wallet data
async function getBlockchainWalletData(user) {
  const blockchainData = {
    metamask: [],
    otherWallets: []
  };

  if (user.connectedWallets && user.connectedWallets.length > 0) {
    for (const wallet of user.connectedWallets) {
      try {
        const walletData = await getBlockchainWalletDetails(wallet.address);
        
        const enhancedWallet = {
          address: wallet.address,
          maskedAddress: maskAddress(wallet.address),
          platform: wallet.platform || 'unknown',
          connectedAt: wallet.connectedAt,
          balance: walletData.balance,
          maticBalance: walletData.maticBalance,
          transactionCount: walletData.transactionCount,
          tokens: walletData.tokens,
          nfts: walletData.nfts,
          lastActivity: walletData.lastActivity
        };

        if (wallet.platform === 'metamask') {
          blockchainData.metamask.push(enhancedWallet);
        } else {
          blockchainData.otherWallets.push(enhancedWallet);
        }
      } catch (error) {
        console.error(`Error fetching data for wallet ${wallet.address}:`, error);
        
        const fallbackWallet = {
          address: wallet.address,
          maskedAddress: maskAddress(wallet.address),
          platform: wallet.platform || 'unknown',
          connectedAt: wallet.connectedAt,
          error: 'Failed to fetch blockchain data',
          balance: 0
        };

        if (wallet.platform === 'metamask') {
          blockchainData.metamask.push(fallbackWallet);
        } else {
          blockchainData.otherWallets.push(fallbackWallet);
        }
      }
    }
  }

  return blockchainData;
}

async function getWalletPortfolioValue(userId) {
  try {
    const [trades, user] = await Promise.all([
      Trade.find({ 
        userId, 
        status: 'executed' 
      }).lean(),
      User.findById(userId)
    ]);

    let totalValue = 0;
    const platformValues = {};

    // Calculate from API keys balances
    if (user.apiKeys) {
      if (user.apiKeys.kalshi) {
        try {
          const kalshiBalance = await kalsh.getBalance(user.apiKeys.kalshi);
          platformValues.kalshi = kalshiBalance;
          totalValue += kalshiBalance;
        } catch (error) {
          platformValues.kalshi = 0;
        }
      }

      if (user.apiKeys.polymarket && user.apiKeys.polymarket.walletKey) {
        try {
          const polyBalance = await poly.getWalletBalance(user.apiKeys.polymarket.walletKey);
          platformValues.polymarket = polyBalance.balance;
          totalValue += polyBalance.balance;
        } catch (error) {
          platformValues.polymarket = 0;
        }
      }
    }

    // Calculate from connected wallets
    if (user.connectedWallets) {
      for (const wallet of user.connectedWallets) {
        try {
          const walletData = await getBlockchainWalletDetails(wallet.address);
          platformValues[wallet.address] = walletData.balance;
          totalValue += walletData.balance;
        } catch (error) {
          platformValues[wallet.address] = 0;
        }
      }
    }

    // Calculate P&L from trades
    const totalTradesVolume = trades.reduce((sum, trade) => sum + (trade.amount || 0), 0);
    const realizedPL = trades
      .filter(trade => trade.realizedPL)
      .reduce((sum, trade) => sum + (trade.realizedPL || 0), 0);

    return {
      totalValue,
      platformValues,
      totalTradesVolume,
      realizedPL,
      unrealizedPL: totalValue - totalTradesVolume + realizedPL,
      lastUpdated: new Date()
    };

  } catch (error) {
    console.error('Error calculating portfolio value:', error);
    return {
      totalValue: 0,
      platformValues: {},
      totalTradesVolume: 0,
      realizedPL: 0,
      unrealizedPL: 0,
      lastUpdated: new Date(),
      error: error.message
    };
  }
}

async function getWalletTransactionHistory(userId) {
  try {
    const user = await User.findById(userId);
    const transactions = [];

    const trades = await Trade.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('marketId', 'title')
      .lean();

    trades.forEach(trade => {
      transactions.push({
        type: 'trade',
        platform: trade.platform,
        hash: trade.externalOrderId,
        amount: trade.amount,
        currency: 'USD',
        timestamp: trade.createdAt,
        status: trade.status,
        description: `${trade.side.toUpperCase()} ${trade.marketId?.title || trade.marketId}`,
        metadata: {
          tradeId: trade._id,
          marketId: trade.marketId,
          side: trade.side,
          price: trade.price
        }
      });
    });

    if (user.connectedWallets) {
      for (const wallet of user.connectedWallets) {
        try {
          const walletTransactions = await getBlockchainTransactions(wallet.address);
          transactions.push(...walletTransactions.map(tx => ({
            ...tx,
            walletAddress: maskAddress(wallet.address)
          })));
        } catch (error) {
          console.error(`Error fetching transactions for wallet ${wallet.address}:`, error);
        }
      }
    }

    transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return transactions.slice(0, 100);

  } catch (error) {
    console.error('Error fetching transaction history:', error);
    return [];
  }
}

async function getWalletSecurityInfo(user) {
  const securityInfo = {
    twoFactorEnabled: user.twoFactorEnabled || false,
    lastPasswordChange: user.lastPasswordChange,
    connectedDevices: user.connectedDevices || [],
    loginAlerts: user.loginAlerts || true,
    apiKeyPermissions: await getApiKeyPermissions(user),
    walletSecurityScore: calculateWalletSecurityScore(user)
  };

  return securityInfo;
}

async function enhanceWithBlockchainData(walletInfo) {
  try {
    const gasPrices = await getCurrentGasPrices();
    walletInfo.blockchainData.gasPrices = gasPrices;

    const networkStatus = await getNetworkStatus();
    walletInfo.blockchainData.networkStatus = networkStatus;

    await updateTokenPrices(walletInfo);

  } catch (error) {
    console.error('Error enhancing with blockchain data:', error);
    walletInfo.blockchainData.enhancementError = error.message;
  }
}

function maskAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

async function getBlockchainWalletDetails(address) {
  return {
    balance: Math.random() * 1000,
    maticBalance: Math.random() * 10,
    transactionCount: Math.floor(Math.random() * 100),
    tokens: [
      {
        symbol: 'USDC',
        balance: Math.random() * 500,
        value: Math.random() * 500
      },
      {
        symbol: 'WETH',
        balance: Math.random() * 0.1,
        value: Math.random() * 200
      }
    ],
    nfts: [],
    lastActivity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
  };
}

async function getBlockchainTransactions(address) {
  return [
    {
      hash: `0x${Math.random().toString(16).substr(2, 64)}`,
      type: 'transfer',
      amount: Math.random() * 100,
      currency: 'MATIC',
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      status: 'confirmed',
      description: 'Token transfer'
    }
  ];
}

async function getCurrentGasPrices() {
  return {
    slow: Math.random() * 50,
    standard: Math.random() * 80,
    fast: Math.random() * 120,
    timestamp: new Date()
  };
}

async function getNetworkStatus() {
  return {
    polygon: {
      status: 'operational',
      blockHeight: Math.floor(Math.random() * 1000000),
      gasPrice: Math.random() * 100
    },
    ethereum: {
      status: 'operational',
      blockHeight: Math.floor(Math.random() * 1000000),
      gasPrice: Math.random() * 50
    }
  };
}

async function updateTokenPrices(walletInfo) {
  const tokenPrices = {
    MATIC: Math.random() * 2,
    USDC: 1.0,
    WETH: Math.random() * 3000
  };

  walletInfo.blockchainData.tokenPrices = tokenPrices;
}

async function getApiKeyPermissions(user) {
  const permissions = {};

  if (user.apiKeys) {
    if (user.apiKeys.kalshi) {
      permissions.kalshi = {
        trading: true,
        reading: true,
        withdrawal: false,
        maxOrderSize: 1000
      };
    }

    if (user.apiKeys.polymarket) {
      permissions.polymarket = {
        trading: true,
        reading: true,
        withdrawal: true,
        maxOrderSize: 5000
      };
    }
  }

  return permissions;
}

function calculateWalletSecurityScore(user) {
  let score = 0;
  let maxScore = 0;

  maxScore += 30;
  if (user.twoFactorEnabled) score += 30;

  maxScore += 20;
  score += 20;

  maxScore += 25;
  if (user.apiKeys) {
    const hasSecureKeys = Object.values(user.apiKeys).every(key => 
      key && key.isActive && key.updatedAt
    );
    if (hasSecureKeys) score += 25;
  }

  maxScore += 25;
  if (user.connectedWallets && user.connectedWallets.length > 0) {
    score += 15;
    const recentWallets = user.connectedWallets.filter(wallet => 
      new Date(wallet.connectedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    if (recentWallets.length === user.connectedWallets.length) {
      score += 10;
    }
  }

  return {
    score: Math.round((score / maxScore) * 100),
    breakdown: {
      twoFactor: user.twoFactorEnabled ? 30 : 0,
      password: 20,
      apiKeys: user.apiKeys ? 25 : 0,
      wallets: user.connectedWallets ? 25 : 0
    }
  };
}

export {
  updateApiKeys,
  getApiKeys,
  deleteApiKeys,
  getWalletInfo,
  
  getConnectionStatus,
  getPortfolio,
  getAccountStats,
  getUserProfile,
  connectMetaMask,
  changePassword,
  enableTwoFactorAuth,
  verifyTwoFactorAuth,
  exportTrades,
  exportPortfolio
};