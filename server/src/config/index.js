import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server root or project root if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: parseInt(process.env.PORT, 10) || 5000,
  clientPort: parseInt(process.env.CLIENT_PORT, 10) || 5173,
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hackhub',
    options: {
      serverSelectionTimeoutMS: 5000,
      autoIndex: process.env.NODE_ENV !== 'production'
    }
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*'
  }
};

export default Object.freeze(config);
