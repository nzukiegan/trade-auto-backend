import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './src/routes/auth.js';
import ruleRoutes from './src/routes/rules.js';
import tradingRoutes from './src/routes/trading.js';
import marketRoutes from './src/routes/markets.js';
import { RuleEngine } from './src/services/ruleEngine.js';
import userRoutes from './src/routes/users.js';
import { WebSocketService } from './src/services/websocketService.js';
import { PolymarketLiveFeed } from './src/services/polymarketWs.js';
import { KalshiLiveFeed } from './src/services/kalshiWs.js';
import { refreshMarkets } from './src/controllers/marketController.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({ server });
const wsService = new WebSocketService(wss);
new PolymarketLiveFeed(wsService);
//new KalshiLiveFeed(wsService);
const ruleEngine = new RuleEngine(wsService)
ruleEngine.start()

app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL
  ],
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/markets', marketRoutes);
app.use('/api/users', userRoutes);

refreshMarkets()

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Trading Automation API'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trading-automation';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { app, wsService, ruleEngine };