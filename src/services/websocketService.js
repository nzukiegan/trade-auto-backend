export class WebSocketService {
  constructor(wss) {
    this.wss = wss;
    this.clients = new Map();
    this.setupWebSocket();
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      console.log('New WebSocket connection');

      const userId = req.url.split('userId=')[1]?.split('&')[0];
      console.log("user id", userId)
      if (userId) {
        this.addClient(userId, ws);
      }

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      });

      ws.on('close', () => {
        this.removeClient(userId, ws);
        console.log('WebSocket connection closed');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeClient(userId, ws);
      });

      ws.send(JSON.stringify({
        type: 'connected',
        message: 'WebSocket connected successfully',
        timestamp: new Date()
      }));
    });
  }

  addClient(userId, ws) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    this.clients.get(userId).push(ws);
    console.log(`Client added for user ${userId}. Total clients: ${this.clients.get(userId).length}`);
  }

  removeClient(userId, ws) {
    if (this.clients.has(userId)) {
      const userClients = this.clients.get(userId);
      const index = userClients.indexOf(ws);
      if (index > -1) {
        userClients.splice(index, 1);
      }
      if (userClients.length === 0) {
        this.clients.delete(userId);
      }
    }
  }

  handleMessage(ws, data) {
    const { type, payload } = data;

    switch (type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date() }));
        break;
      default:
        console.log('Unknown message type:', type);
    }
  }

  broadcastToUser(userId, message) {
    if (this.clients.has(userId)) {
      const userClients = this.clients.get(userId);
      userClients.forEach(client => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    }
  }

  broadcastToAll(message) {
    this.clients.forEach((userClients, userId) => {
      userClients.forEach(client => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    });
  }

  on(event, callback) {
    if (!this.eventCallbacks) {
      this.eventCallbacks = new Map();
    }
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event).push(callback);
  }

  emit(event, data) {
    if (this.eventCallbacks && this.eventCallbacks.has(event)) {
      this.eventCallbacks.get(event).forEach(callback => {
        callback(data);
      });
    }
  }

  sendMarketData(marketData) {
    this.broadcastToAll({
      type: 'market_data',
      data: marketData,
      timestamp: new Date()
    });

    this.emit('marketData', marketData);
  }
}