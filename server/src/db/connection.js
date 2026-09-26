import mongoose from 'mongoose';
import config from '../config/index.js';

const STATE_NAMES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

/**
 * Connect to MongoDB database
 * @param {string} [uri] Optional URI override (e.g. for testing)
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDB(uri = config.database.uri) {
  try {
    if (mongoose.connection.readyState === 1) {
      return mongoose;
    }

    const conn = await mongoose.connect(uri, config.database.options);
    console.log(`[Database] Successfully connected to MongoDB at ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[Database] Connection error: ${error.message}`);
    throw error;
  }
}

/**
 * Disconnect from MongoDB database
 * @returns {Promise<void>}
 */
export async function disconnectDB() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('[Database] Disconnected from MongoDB');
    }
  } catch (error) {
    console.error(`[Database] Disconnect error: ${error.message}`);
    throw error;
  }
}

/**
 * Get current database status
 * @returns {{ connected: boolean, state: string, readyState: number, host?: string, name?: string }}
 */
export function getDBStatus() {
  const readyState = mongoose.connection.readyState;
  const isConnected = readyState === 1;

  return {
    connected: isConnected,
    state: STATE_NAMES[readyState] || 'unknown',
    readyState,
    host: isConnected ? mongoose.connection.host : undefined,
    name: isConnected ? mongoose.connection.name : undefined
  };
}

/**
 * Initialize and verify database readiness
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function initDatabase() {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    // Ping the database to verify active round-trip communication
    await mongoose.connection.db.admin().ping();
    return {
      success: true,
      message: 'Database initialized and responsive'
    };
  } catch (error) {
    return {
      success: false,
      message: `Database initialization check failed: ${error.message}`
    };
  }
}

// Connection lifecycle event listeners
mongoose.connection.on('connected', () => {
  console.log('[Database] Mongoose event: connected');
});

mongoose.connection.on('error', (err) => {
  console.error(`[Database] Mongoose event: error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.log('[Database] Mongoose event: disconnected');
});

export default {
  connectDB,
  disconnectDB,
  getDBStatus,
  initDatabase
};
