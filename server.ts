import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Models & DB
import db, { sequelize } from './src/models/index';

// Routes
import userRoutes from './src/routes/userRoutes';
import authRoutes from './src/routes/authRoutes';
import productRoutes from './src/routes/productRoutes';
import categoryRoutes from './src/routes/categoryRoutes';
import customerRoutes from './src/routes/customerRoutes';
import wishlistRoutes from './src/routes/wishlistRoutes';
import orderRoutes from './src/routes/orderRoutes';

// Middleware
import { errorHandler } from './src/middleware/errorHandler';
import logger from './src/config/logger';

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Proper CORS setup
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = ['http://localhost:5173', 'https://fastshopping.rw'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));


app.use(express.json());
app.use(morgan('dev'));

// ✅ Add a quick sanity check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ✅ Register routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/wishlists', wishlistRoutes);
app.use('/api/orders', orderRoutes);

// ✅ Global error handling
app.use(errorHandler);

// ✅ Safe boot sequence
const startServer = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
      logger.info('Database synchronized');
    }

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();