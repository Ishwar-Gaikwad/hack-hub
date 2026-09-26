import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB, disconnectDB, getDBStatus, initDatabase } from '../src/db/connection.js';

describe('Database Connection and Initialization', () => {
  let mongod;
  let testUri;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    testUri = mongod.getUri();
  });

  afterAll(async () => {
    await disconnectDB();
    if (mongod) {
      await mongod.stop();
    }
  });

  it('reports disconnected status initially if not connected', async () => {
    await disconnectDB();
    const status = getDBStatus();
    expect(status.connected).toBe(false);
    expect(status.state).toBe('disconnected');
    expect(status.readyState).toBe(0);
  });

  it('connects to MongoDB instance successfully', async () => {
    const conn = await connectDB(testUri);
    expect(conn).toBeDefined();
    const status = getDBStatus();
    expect(status.connected).toBe(true);
    expect(status.state).toBe('connected');
    expect(status.readyState).toBe(1);
    expect(status.host).toBeDefined();
  });

  it('runs initDatabase verification and succeeds on clean database', async () => {
    const initResult = await initDatabase();
    expect(initResult.success).toBe(true);
    expect(initResult.message).toContain('initialized');
  });

  it('disconnects cleanly from MongoDB', async () => {
    await disconnectDB();
    const status = getDBStatus();
    expect(status.connected).toBe(false);
    expect(status.readyState).toBe(0);
  });
});
