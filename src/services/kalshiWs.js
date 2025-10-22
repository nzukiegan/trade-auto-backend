import WebSocket from 'ws';
import crypto from 'crypto';
import Market from '../models/Market.js';
import { KalshiService } from './kalshiService.js';

export class KalshiLiveFeed {
  constructor(ws) {
    this.ws = null;
    this.wsService = ws;
    this.marketTickers = [];
    this.kalshiService = new KalshiService();
    this.connect();
  }

  async connect() {
    try {
      const markets = await this.kalshiService.getMarkets();
      this.marketTickers = markets.map(m => m.ticker).filter(Boolean);

      const WS_URL = 'wss://trading-api.kalshi.com/trade-api/ws/v2';
      const API_KEY = process.env.KALSHI_API_KEY_ID;
      const API_SECRET = process.env.KALSHI_API_SECRET;
      const timestamp = Date.now().toString();

      const message = `${timestamp}GET/trade-api/ws/v2`;
      const signature = crypto.createHmac('sha256', API_SECRET)
        .update(message)
        .digest('hex');

      const headers = {
        'KALSHI-ACCESS-KEY': API_KEY,
        'KALSHI-ACCESS-TIMESTAMP': timestamp,
        'KALSHI-ACCESS-SIGNATURE': signature,
      };

      this.ws = new WebSocket(WS_URL, { headers });

      this.ws.on('open', () => {
        console.log('✅ Connected to Kalshi WebSocket');

        const subMsg = {
          id: 1,
          cmd: 'subscribe',
          params: {
            channels: ['ticker'],
            market_tickers: this.marketTickers,
          },
        };

        this.ws.send(JSON.stringify(subMsg));
      });

      this.ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(data);
          await this.updateDatabase(data);
        } catch (err) {
          console.error('Kalshi WS parse error:', err.message);
        }
      });

      this.ws.on('close', () => {
        console.warn('❌ Kalshi WS disconnected. Reconnecting in 5s...');
        setTimeout(() => this.connect(), 5000);
      });

      this.ws.on('error', (err) => {
        console.error('Kalshi WS error:', err);
      });

      setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 10000);

    } catch (error) {
      console.error('Failed to initialize Kalshi Live Feed:', error);
    }
  }

  handleMessage(data) {
    if (!data) return;
    this.wsService.sendMarketData(data, "ticker");
  }

  async updateDatabase(data) {
    if (!data || data.type !== 'ticker') return;

    try {
      const { market_ticker, bid, ask, last_price } = data.data || {};
      if (!market_ticker) return;

      const marketDoc = await Market.findOne({ marketId: market_ticker });
      if (!marketDoc) {
        console.warn(`⚠️ Market not found for ticker: ${market_ticker}`);
        return;
      }

      let prices = [];
      try {
        prices = JSON.parse(marketDoc.outcomePrices || '[]');
      } catch {
        prices = [];
      }

      prices[0] = parseFloat(last_price);
      prices[1] = 1 - last_price;

      marketDoc.outcomePrices = JSON.stringify(prices);
      marketDoc.bestBid = parseFloat(bid || marketDoc.bestBid || 0);
      marketDoc.bestAsk = parseFloat(ask || marketDoc.bestAsk || 0);
      marketDoc.spread = Math.abs(marketDoc.bestAsk - marketDoc.bestBid);
      marketDoc.lastUpdated = new Date();

      await marketDoc.save();
    } catch (err) {
      console.error('❌ Error updating Kalshi DB:', err);
    }
  }
}
