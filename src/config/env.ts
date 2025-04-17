import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'ecommerce',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: process.env.DB_LOGGING === 'true',
    forceSync: process.env.DB_FORCE_SYNC === 'true',
  },
  
  jwt: {
    // Make sure the secret is a string
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  bcrypt: {
    saltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
  },
  
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;