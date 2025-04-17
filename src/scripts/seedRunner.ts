import { seedAdminAndRoles } from './seed-admin';
import sequelize from '../config/db';
import logger from '../config/logger';

/**
 * Run database seeding
 */
const runSeeding = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
    
    // Run seeding
    await seedAdminAndRoles();
    logger.info('Database seeding completed successfully.');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during database seeding:', error);
    process.exit(1);
  }
};

// Run the seeding process
runSeeding();