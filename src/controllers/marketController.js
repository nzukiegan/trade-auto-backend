import { platform } from 'os';
import Market from '../models/Market.js';
import { KalshiService } from '../services/kalshiService.js';
import { PolymarketService } from '../services/polymarketService.js';
import { ruleEngine } from '../../server.js';

export const getMarkets = async (req, res) => {
    console.log("Get markets called");
  try {
    const { platform, category, search, activeOnly = true } = req.query;
    
    const filter = {};
    
    if (platform) filter.platform = platform;
    if (category) filter.category = category;
    if (activeOnly) filter.active = true;
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const markets = await Market.find(filter)
      .sort({ volume: -1})


    res.json({
      markets,
      count: markets.length
    });
  } catch (error) {
    console.error('Get markets error:', error);
    res.status(500).json({
      message: 'Error fetching markets',
      error: error.message
    });
  }
};

export const getMarket = async (req, res) => {
  try {
    const market = await Market.findOne({
      marketId: req.params.marketId
    });

    if (!market) {
      return res.status(404).json({
        message: 'Market not found'
      });
    }

    res.json({ market });
  } catch (error) {
    console.error('Get market error:', error);
    res.status(500).json({
      message: 'Error fetching market',
      error: error.message
    });
  }
};

export const refreshMarkets = async (req, res) => {
  try {
    const platformQuery = req?.query?.platform || 'all';

    const now = new Date();
    const deleteResult = await Market.deleteMany({
      endDate: { $ne: null, $lt: now },
    });

    const updatedMarkets = [];
    let createdCount = 0;
    let updatedCount = 0;

    const processMarkets = async (platform, markets) => {
      for (const platformMarket of markets) {
        const marketId = platformMarket.id || platformMarket.marketId;
        if (!marketId) continue;

        const existingMarket = await Market.findOne({ marketId });

        const marketData = {
          platform,
          marketId,
          image: platformMarket.image || '',
          title: platformMarket.title || '',
          description: platformMarket.description || '',
          category: platformMarket.category || 'general',
          outcomes: platformMarket.outcomes || [],
          outcomePrices: platformMarket.outcomePrices || [],
          volume: platformMarket.volume || 0,
          clobTokenIds: platformMarket.clobTokenIds || [],
          liquidity: platformMarket.liquidity || 0,
          endDate: platformMarket.endDate || null,
          isActive: platformMarket.active !== false,
        };

        let marketDoc;

        if (existingMarket) {
          await Market.updateOne({ _id: existingMarket._id }, { $set: marketData });
          updatedCount++;
          marketDoc = { ...existingMarket.toObject(), ...marketData };
        } else {
          marketDoc = await Market.create(marketData);
          createdCount++;
        }

        ruleEngine.handleMarketDataUpdate(marketDoc);
        updatedMarkets.push(marketDoc);
      }
    };
    try{
        if (platformQuery === 'kalshi' || platformQuery === 'all') {
          const kalshiService = new KalshiService();
          const kalshiMarkets = await kalshiService.getMarkets();
          await processMarkets('kalshi', kalshiMarkets);
        }
    }catch(error){
      console.error('❌ Error refreshing kalsi markets:', error);
    }

    try{
      if (platformQuery === 'polymarket' || platformQuery === 'all') {
        const polymarketService = new PolymarketService();
        const sports = await polymarketService.getSports();
        const marketsBySport = await Promise.all(
          sports.map((sport) => polymarketService.getMarkets(sport.tagId))
        );
        const polymarketMarkets = marketsBySport.flat();
        await processMarkets('polymarket', polymarketMarkets);
      }
    }catch(error){
      console.error('❌ Error refreshing polymarkets', error);
    }

    if (res) {
      res.json({
        message: 'Markets refreshed successfully',
        created: createdCount,
        updated: updatedCount,
        removed: deleteResult.deletedCount,
        platform: platformQuery,
        markets: updatedMarkets,
      });
    }
  } catch (error) {
    console.error('❌ Error refreshing markets:', error);
    if (res) {
      res.status(500).json({
        error: 'Failed to refresh markets',
        details: error.message,
      });
    }
  }
};

export const getMarketCategories = async (req, res) => {
  try {
    const categories = await Market.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          platforms: { $addToSet: '$platform' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({ categories });
  } catch (error) {
    console.error('Get market categories error:', error);
    res.status(500).json({
      message: 'Error fetching market categories',
      error: error.message
    });
  }
};