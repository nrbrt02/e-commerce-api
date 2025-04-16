import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  server: {
    port: number;
    nodeEnv: string;
  };
  db: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  jwt: {
    secret: string; // Keep as string type for simplicity
    expiresIn: string;
  };
  bcrypt: {
    saltRounds: number;
  };
  logging: {
    level: string;
  };
}

// Default configuration
const config: Config = {
  server: {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'notes_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default_jwt_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  bcrypt: {
    saltRounds: Number(process.env.SALT_ROUNDS) || 10,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Validate critical configuration
if (config.server.nodeEnv === 'production') {
  if (config.jwt.secret === 'default_jwt_secret_key') {
    throw new Error('JWT_SECRET must be set in production environment');
  }
}

export default config;