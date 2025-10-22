import axios from 'axios';
import fs from 'fs';
import crypto from 'crypto';

export class KalshiService {
  constructor(apiKey = '', secret = '') {
    this.apiKey = apiKey;
    this.secret = secret;
    this.baseURL = process.env.KALSHI_API_URL || 'https://api.elections.kalshi.com/trade-api/v2';
    this.path = '/portfolio/orders'
    this.private_pem = fs.readFileSync(process.env.KALSHI_PRIVATE_KEY_PATH, 'utf8');
    this.privateKey = crypto.createPrivateKey({ key: this.private_pem, format: 'pem' });

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  _mapMarketToDesiredShape(event, m) {
    const num = v => (v == null ? 0 : Number(v));

    const yesLabel = m.yes_sub_title || 'Yes';
    const noLabel  = m.no_sub_title  || 'No';

    const outcomes = [yesLabel, noLabel]

    const outcomePrices = [num(m.yes_ask), num(m.no_ask)]

    const status = (m.status || '').toLowerCase();
    const active = (status === 'open' || status === 'trading' || status === 'live');
    const closed = (status === 'closed' || status === 'settled' || status === 'expired');

    return {
      id: m.ticker || m.id || `${event.event_ticker}:${m.ticker || 'unknown'}`,
      title: m.title || event.title || '',
      question: m.title || event.title || '',
      category: m.category || event.category || '',
      image: null,
      icon: m.icon || null,
      endDate: m.close_time ? new Date(m.close_time) : (m.expiration_time ? new Date(m.expiration_time) : null),
      liquidity: num(m.liquidity),
      volume: num(m.volume ?? m.volume_24h),
      active,
      closed,
      clobTokenIds: m.clobTokenIds || '[]',
      outcomes,
      outcomePrices
    };
  }

  async getMarkets({ limit = 200, cursor = null, fetchAll = false, onlySports = true } = {}) {
    const mappedMarkets = [];
    let pageCursor = cursor;
    let pagesFetched = 0;
    const maxPages = 50;

    do {
      const url = new URL(`${API_BASE}/events`);
      url.searchParams.set('with_nested_markets', 'true');
      url.searchParams.set('limit', String(limit));
      if (pageCursor) url.searchParams.set('cursor', pageCursor);

      const res = await fetch(url.toString());
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Kalshi API error ${res.status} ${res.statusText} ${txt}`);
      }
      const body = await res.json();
      const events = body.events || [];

      for (const ev of events) {
        if (onlySports && ((ev.category || '').toLowerCase() !== 'sports')) continue;
        for (const m of (ev.markets || [])) {
          mappedMarkets.push(_mapMarketToDesiredShape(ev, m));
        }
      }

      pageCursor = body.cursor || null;
      pagesFetched += 1;

      if (!fetchAll) break;
      if (!pageCursor) break;
      if (pagesFetched >= maxPages) {
        console.warn('getMarkets stopped after maxPages safety limit');
        break;
      }
    } while (true);

    return mappedMarkets
  }

  async getMarketData(marketId) {
    try {
      const response = await this.client.get(`/markets/${marketId}`);
      const market = response.data.market;
      
      return {
        marketId: market.ticker,
        yesPrice: market.last_price / 100,
        noPrice: (100 - market.last_price) / 100,
        volume: market.volume,
        openInterest: market.open_interest,
        bid: market.bid / 100,
        ask: market.ask / 100,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Kalshi get market data error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch market data for ${marketId}`);
    }
  }

  async placeOrder({action, side, type, ticker, yes_price, count }) {
    const timestamp = Date.now().toString();
    const method = 'POST';
    const path   = this.path;
    
    const message   = timestamp + method + path;
    const signature = crypto.sign('sha256', Buffer.from(message), {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
    }).toString('base64');

    const headers = {
      'KALSHI-ACCESS-KEY':       this.apiKey,
      'KALSHI-ACCESS-TIMESTAMP': timestamp,
      'KALSHI-ACCESS-SIGNATURE': signature,
      'Content-Type':            'application/json'
    };

    const body = {
      action:        action,
      client_order_id: crypto.randomUUID(),
      count:         count, 
      side:          side,
      ticker:        ticker,
      type:          type,
      yes_price:     yes_price
    };

    try {
      const resp = await axios.post(API_BASE + path, body, { headers });
      console.log('Order placed:', resp.data);
      return resp.data;
    } catch (err) {
      console.error('Order error:', err.response?.data || err.message);
      throw err;
    }
  }

  async cancelOrder(orderId) {
    try {
      await this.client.delete(`/orders/${orderId}`);
      return { success: true };
    } catch (error) {
      console.error('Kalshi cancel order error:', error.response?.data || error.message);
      throw new Error(`Failed to cancel order: ${error.response?.data?.error || error.message}`);
    }
  }

  async getPortfolio() {
    try {
      const response = await this.client.get('/portfolio');
      return response.data.portfolio;
    } catch (error) {
      console.error('Kalshi get portfolio error:', error.response?.data || error.message);
      throw new Error('Failed to fetch portfolio');
    }
  }

   async getOrderBook(marketId) {
        try {
            const response = await this.client.get(`/markets/${marketId}/orderbook`);
            return response.data;
        } catch (error) {
            console.error('Kalshi get order book error:', error.response?.data || error.message);
            throw new Error(`Failed to fetch order book for ${marketId}`);
        }
    }

    async getMarketDepth(marketId) {
        try {
            const response = await this.client.get(`/markets/${marketId}/depth`);
            return response.data;
        } catch (error) {
            console.error('Kalshi get market depth error:', error.response?.data || error.message);
            throw new Error(`Failed to fetch market depth for ${marketId}`);
        }
    }
}
