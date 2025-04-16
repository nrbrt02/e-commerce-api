import { Sequelize, DataTypes } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import logger from '../config/logger';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Database configuration
const dbName = process.env.DB_NAME || 'ecommerce';
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || '';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
const dbDialect = process.env.DB_DIALECT || 'postgres';

// Create Sequelize instance
export const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: dbDialect as any, // Cast to any since TypeScript might not recognize all dialect options
  logging: (msg) => logger.debug(msg),
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Import all models and associations
const db: any = {};

// Read all model files in the current directory
fs.readdirSync(__dirname)
  .filter(file => 
    file.indexOf('.') !== 0 && 
    file !== 'index.ts' &&
    file.slice(-3) === '.ts'
  )
  .forEach(file => {
    try {
      // Import model file
      const modelModule = require(path.join(__dirname, file));
      
      // Check if the module has a default export that's a function
      if (typeof modelModule.default === 'function') {
        const model = modelModule.default(sequelize, DataTypes);
        db[model.name] = model;
      } else {
        // If it's already a model instance
        if (modelModule.default && modelModule.default.name) {
          db[modelModule.default.name] = modelModule.default;
        } else {
          logger.warn(`Model file ${file} doesn't export a valid model`);
        }
      }
    } catch (error) {
      logger.error(`Error importing model from file ${file}:`, error);
    }
  });

// Create associations between models
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Add sequelize and Sequelize to the db object
db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;