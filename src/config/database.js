import mongoose from 'mongoose';
import { ENVIRONMENT, LOG_LEVELS } from '../utils/constants.js';

/**
 * Database configuration and connection management
 */

class Database {
  constructor() {
    this.isConnected = false;
    this.connection = null;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    try {
      const MONGODB_URI = process.env.MONGODB_URI
      
      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
        bufferMaxEntries: 0,
        useNewUrlParser: true,
        useUnifiedTopology: true,
      };

      console.log('🔄 Connecting to MongoDB...');
      
      this.connection = await mongoose.connect(MONGODB_URI, options);
      this.isConnected = true;
      this.retryCount = 0;

      console.log('✅ MongoDB connected successfully');
      
      this.setupEventListeners();
      
      return this.connection;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error.message);
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`🔄 Retrying connection in ${this.retryDelay / 1000} seconds... (Attempt ${this.retryCount}/${this.maxRetries})`);
        
        await this.sleep(this.retryDelay);
        return this.connect();
      } else {
        console.error('💥 Maximum connection retries reached. Exiting...');
        process.exit(1);
      }
    }
  }

  /**
   * Setup database event listeners
   */
  setupEventListeners() {
    mongoose.connection.on('connected', () => {
      console.log('✅ Mongoose connected to MongoDB');
      this.isConnected = true;
    });

    mongoose.connection.on('error', (error) => {
      console.error('❌ Mongoose connection error:', error);
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ Mongoose disconnected from MongoDB');
      this.isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ Mongoose reconnected to MongoDB');
      this.isConnected = true;
    });

    // Close the Mongoose connection when the application is terminated
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
  }

  /**
   * Gracefully shutdown the database connection
   */
  async gracefulShutdown() {
    console.log('🔄 Closing MongoDB connection...');
    
    try {
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed gracefully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error closing MongoDB connection:', error);
      process.exit(1);
    }
  }

  /**
   * Check if database is connected
   */
  isDatabaseConnected() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Get database connection status
   */
  getConnectionStatus() {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized'
    };

    return {
      isConnected: this.isConnected,
      readyState: states[mongoose.connection.readyState] || 'unknown',
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
      models: Object.keys(mongoose.connection.models)
    };
  }

  /**
   * Create database indexes for better performance
   */
  async createIndexes() {
    try {
      console.log('🔄 Creating database indexes...');
      
      // Get all models
      const models = mongoose.connection.models;
      
      for (const modelName in models) {
        const model = models[modelName];
        
        if (typeof model.createIndexes === 'function') {
          await model.createIndexes();
          console.log(`✅ Indexes created for ${modelName}`);
        }
      }
      
      console.log('✅ All database indexes created successfully');
    } catch (error) {
      console.error('❌ Error creating database indexes:', error);
    }
  }

  /**
   * Drop database (for testing purposes)
   */
  async dropDatabase() {
    if (process.env.NODE_ENV !== ENVIRONMENT.TEST) {
      throw new Error('Database can only be dropped in test environment');
    }

    try {
      await mongoose.connection.db.dropDatabase();
      console.log('✅ Test database dropped successfully');
    } catch (error) {
      console.error('❌ Error dropping test database:', error);
      throw error;
    }
  }

  /**
   * Sleep helper function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    try {
      if (!this.isDatabaseConnected()) {
        throw new Error('Database not connected');
      }

      const adminDb = mongoose.connection.db.admin();
      const serverStatus = await adminDb.serverStatus();
      const dbStats = await mongoose.connection.db.stats();

      return {
        server: {
          version: serverStatus.version,
          host: serverStatus.host,
          uptime: serverStatus.uptime,
          connections: serverStatus.connections
        },
        database: {
          name: dbStats.db,
          collections: dbStats.collections,
          objects: dbStats.objects,
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize,
          indexSize: dbStats.indexSize
        },
        connection: this.getConnectionStatus()
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return null;
    }
  }

  /**
   * Monitor database performance
   */
  startPerformanceMonitoring() {
    // Monitor slow queries
    mongoose.set('debug', (collectionName, method, query, doc) => {
      if (process.env.NODE_ENV === ENVIRONMENT.DEVELOPMENT) {
        console.log(`Mongoose: ${collectionName}.${method}`, {
          query: JSON.stringify(query),
          doc: JSON.stringify(doc)
        });
      }
    });

    // Monitor query execution time
    const slowQueryThreshold = 100; // milliseconds
    
    mongoose.connection.on('query', (data) => {
      const { collectionName, method, query, executionTime } = data;
      
      if (executionTime > slowQueryThreshold) {
        console.warn(`Slow query detected: ${collectionName}.${method} took ${executionTime}ms`, {
          query: JSON.stringify(query),
          executionTime
        });
      }
    });
  }

  /**
   * Initialize database with sample data (for development)
   */
  async initializeWithSampleData() {
    if (process.env.NODE_ENV !== ENVIRONMENT.DEVELOPMENT) {
      return;
    }

    try {
      console.log('🔄 Initializing database with sample data...');
      
      // Add sample data initialization logic here
      // This could include creating default users, markets, etc.
      
      console.log('✅ Sample data initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing sample data:', error);
    }
  }
}

// Create and export a singleton instance
const database = new Database();

export default database;