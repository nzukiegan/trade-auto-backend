import WebSocket from 'ws';
import { PolymarketService } from './polymarketService.js';
import Market from '../models/Market.js';

export class PolymarketLiveFeed {
  constructor(ws) {
    this.ws = null;
    this.polymarketApi = new PolymarketService();
    this.wsService = ws
    this.clobTokenIds = [];
    this.connect();
  }

  async connect() {
    try {
        const marketService = new PolymarketService()
        const sports = await marketService.getSports();
        const marketsBySport = await Promise.all(
            sports.map((sport) => marketService.getMarkets(sport.tagId))
        );

        const markets = marketsBySport.flat()
        this.clobTokenIds = markets
            .filter(m => m.clobTokenIds && m.clobTokenIds.length > 0)
            .flatMap(m => Array.isArray(m.clobTokenIds) ? m.clobTokenIds : JSON.parse(m.clobTokenIds));

        this.ws = new WebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market')

        this.ws.on('open', () => {
            console.log('✅ Connected to Polymarket WebSocket');

            if (this.clobTokenIds.length > 0) {
            this.ws.send(JSON.stringify({
                type: 'market',
                assets_ids: this.clobTokenIds
            }));
            }
        });

        this.ws.on('message', (message) => {
            try {
            const data = JSON.parse(message.toString());
            this.handleMessage(data);
            this.updateDatabase(data);
            } catch (err) {
            //console.error('Polymarket WS message error:', err.message);
            }
        });

        this.ws.on('close', () => {
            console.warn('❌ Polymarket WS disconnected, reconnecting...');
            setTimeout(() => this.connect(), 5000);
        });

        this.ws.on('error', (err) => {
            console.error('Polymarket WS error:', err);
        });

        setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 10000);

    } catch (error) {
      console.error('Failed to initialize Polymarket Live Feed:', error);
    }
  }

  handleMessage(data) {
    if (!data) return;
    this.wsService.sendMarketData(data, "pdata");
  }

  async updateDatabase(data) {
    if (!data || !data.event_type) return;

    try {
        switch (data.event_type) {
          case 'price_change': {
              const { price_changes } = data;
              if (!price_changes?.length) return;

              for (const change of price_changes) {
                const { asset_id, price, best_bid, best_ask } = change;

                const markets = await Market.find();
                const marketDoc = markets.find(m => {
                    let tokenIds = [];
                    try {
                    tokenIds = Array.isArray(m.clobTokenIds)
                        ? m.clobTokenIds
                        : JSON.parse(m.clobTokenIds || '[]');
                    } catch {
                    tokenIds = [];
                    }
                    tokenIds = this.extractClobJsonString(tokenIds)
                    return tokenIds.includes(asset_id);
                });

                if (!marketDoc) {
                    console.warn(`⚠️ Market not found for asset_id: ${asset_id}`);
                    continue;
                }

                let prices = [];
                try {
                    prices = JSON.parse(marketDoc.outcomePrices || '[]');
                } catch {
                    prices = [];
                }

                const tokenIds = Array.isArray(marketDoc.clobTokenIds)
                    ? marketDoc.clobTokenIds
                    : JSON.parse(marketDoc.clobTokenIds || '[]');

                const tokenIndex = tokenIds.indexOf(asset_id);
                if (tokenIndex !== -1) {
                    prices[tokenIndex] = parseFloat(price);
                }

                marketDoc.outcomePrices = JSON.stringify(prices);
                marketDoc.bestBid = parseFloat(best_bid || marketDoc.bestBid || 0);
                marketDoc.bestAsk = parseFloat(best_ask || marketDoc.bestAsk || 0);
                marketDoc.spread = Math.abs(marketDoc.bestAsk - marketDoc.bestBid);
                marketDoc.lastUpdated = new Date();

                await marketDoc.save();

              }
              break;
          }

          default:
            //do nothing
        }
    } catch (err) {
        console.error('❌ Error updating database:', err);
    }
  }

  extractClobJsonString(clob) {
    if (clob == null) return null;

    if (Array.isArray(clob)) {
      if (clob.length === 0) return null;

      if (clob.length === 1 && typeof clob[0] === 'string') {
        const s = clob[0].trim();
        if (s.startsWith('[')) {
          return s;
        }
      }

      const allStrings = clob.every(i => typeof i === 'string');
      if (allStrings) {
        return JSON.stringify(clob);
      }

      for (const item of clob) {
        if (typeof item === 'string' && item.trim().startsWith('[')) {
          return item.trim();
        }
      }
      return JSON.stringify(clob.map(String));
    }

    if (typeof clob === 'string') {
      const s = clob.trim();
      if (s.startsWith('[')) {
        return s;
      }
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return JSON.stringify(parsed);
      } catch (e) {
      }
      return JSON.stringify([s]);
    }
    try {
      return JSON.stringify(clob);
    } catch (e) {
      return null;
    }
  }

}