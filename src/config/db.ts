import { Sequelize } from 'sequelize';
import config from './env';
import logger from './logger';

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  username: config.db.user,
  password: config.db.password,
  logging: (msg) => logger.debug(msg),
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// Function to test database connection
export const testConnection = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
};

// Function to sync models with database
export const syncDatabase = async (): Promise<void> => {
  try {
    await sequelize.sync({ alter: config.server.nodeEnv === 'development' });
    logger.info('Database synchronized successfully.');
  } catch (error) {
    logger.error('Unable to sync database:', error);
    throw error;
  }
};

export default sequelize;