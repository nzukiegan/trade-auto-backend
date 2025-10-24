import axios from 'axios';
import { ClobClient, Side, OrderType } from "@polymarket/clob-client";
import { Wallet } from "ethers";
import dotenv from 'dotenv';
dotenv.config();

const host = process.env.POLYMARKET_CLOB_HOST
const METAKEY = process.env.METAKEY
const chainId = 137;
const signer = new Wallet(METAKEY);

const clobClient = new ClobClient(host, chainId, signer);
const creds = await clobClient.createOrDeriveApiKey()
const signatureType = 0; 
const authenticatedClient = new ClobClient(
  host, 
  chainId, 
  signer, 
  creds, 
  signatureType
);

export class PolymarketService {
  constructor(apiKey = '') {
    this.apiKey = process.env.POLY_API_KEY
    console.log("api key", this.apiKey)
    this.baseURL = process.env.POLYMARKET_API_URL;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getSports() {
    try {
      const response = await this.client.get('/sports');
      return response.data.map(sport => ({
        id: sport.id,
        name: sport.name,
        tagId: sport.tags.split(',')[1]
      }));
    } catch (error) {
      console.error('Error fetching sports:', error.response?.data || error.message);
      throw new Error('Failed to fetch sports metadata');
    }
  }

  async getPortfolio() {
      try {
      const response = await this.client.get('/portfolio');
      const portfolio = response.data;

      const positions = (portfolio.positions || portfolio.tokens || []).map(pos => ({
        tokenId: pos.token_id || pos.tokenId || pos.id,
        marketId: pos.market_id || pos.marketId,
        outcome: pos.outcome_name || pos.outcome,
        size: Number(pos.size || pos.amount || 0),
        avgPrice: Number(pos.avg_price || pos.averagePrice || 0),
        value: Number(pos.value || pos.valuation || 0)
      }));

      return {
        balance: Number(portfolio.balance || portfolio.wallet_balance || 0),
        totalValue: Number(portfolio.total_value || 0),
        positions,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Polymarket getPortfolio error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch Polymarket portfolio: ${error.response?.data?.error || error.message}`);
    }
  }

  async getMarkets(tagId, limit = 10, offset = 0) {
    try {
      const today = new Date().toISOString().split('T')[0];   
      const response = await this.client.get('/markets', {
        params: {
          tag_id: tagId,
          closed: false,
          end_date_min: today,
          limit,
          offset
        }
      });
      return response.data.map(market => ({
        id: market.id,
        title: market.question,
        question: market.question,
        category: market.category,
        image: market.image,
        icon: market.icon,
        endDate: market.endDate ? new Date(market.endDate) : null,
        liquidity: Number(market.liquidityNum || 0),
        volume: Number(market.volumeNum || 0),
        active: market.active,
        closed: market.closed,
        clobTokenIds: market.clobTokenIds || '[]' ,
        outcomes: market.outcomes || '[]',
        outcomePrices: market.outcomePrices || '[]'
      }));
    } catch (error) {
      console.error(`Error fetching sports markets for tag ${tagId}:`, error.response?.data || error.message);
      throw new Error(`Failed to fetch markets for sports tag ${tagId}`);
    }
  }

  async getMarketData(marketId) {
    try {
      const response = await this.client.get(`/markets/${marketId}`);
      const market = response.data;

      return {
        marketId: market.id,
        question: market.question,
        image: market.image,
        outcomes: market.outcomes || '[]',
        outcomePrices: market.outcomePrices || '[]',
        volume: Number(market.volumeNum || market.volume || 0),
        liquidity: Number(market.liquidityNum || market.liquidity || 0),
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Error fetching market data for ${marketId}:`, error.response?.data || error.message);
      throw new Error(`Failed to fetch market data for ${marketId}`);
    }
  }

  async placeOrder(token_Id, price, size, actionType) {
    try {
      const order = await authenticatedClient.createOrder({
        tokenID: token_Id,
        price: price,
        side: (actionType == 'buy')? Side.BUY : Side.SELL,
        size: size,
      });

      console.log("order placed", order)

      const resp = await authenticatedClient.postOrder(order, OrderType.GTC);
      console.log(resp);
      
      return {
        orderId: response.data.id,
        status: response.data.status,
        filled: response.data.filledAmount,
        remaining: response.data.remainingAmount
      };
    } catch (error) {
      console.error('Polymarket place order error:', error.response?.data || error.message);
      throw new Error(`Failed to place order: ${error.response?.data?.error || error.message}`);
    }
  }

  async cancelOrder(orderId) {
    try {
      await this.client.delete(`/orders/${orderId}`);
      return { success: true };
    } catch (error) {
      console.error('Polymarket cancel order error:', error.response?.data || error.message);
      throw new Error(`Failed to cancel order: ${error.response?.data?.error || error.message}`);
    }
  }

  async getOrderBook(marketId) {
    try {
      const response = await this.client.get(`/markets/${marketId}/orderbook`);
      return response.data;
    } catch (error) {
      console.error('Polymarket get order book error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch order book for ${marketId}`);
    }
  }

  async getMarketDepth(marketId) {
    try {
      const response = await this.client.get(`/markets/${marketId}/depth`);
      return response.data;
    } catch (error) {
      console.error('Polymarket get market depth error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch market depth for ${marketId}`);
    }
  }

  async getPortfolio() {
    try {
      const response = await this.client.get('/portfolio');
      return {
        balance: response.data.balance || 0,
        positions: response.data.positions || []
      };
    } catch (error) {
      console.error('Polymarket get portfolio error:', error.response?.data || error.message);
      return { balance: 0, positions: [] };
    }
  }

    async getWalletBalance() {
      try {
        const balances = await authenticatedClient.getBalances();
        console.log("Wallet balances:", balances);
        
        return balances;
      } catch (error) {
        console.error('Polymarket get wallet balance error:', error.response?.data || error.message);
        throw new Error(`Failed to fetch wallet balance: ${error.response?.data?.error || error.message}`);
      }
    }
}