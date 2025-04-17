import express from 'express';
import authRoutes from './authRoutes';
import categoryRoutes from './categoryRoutes';
import customerRoutes from './customerRoutes';
import orderRoutes from './orderRoutes';
import productRoutes from './productRoutes';
import reviewRoutes from './reviewRoutes';
import uploadRoutes from './uploadRoutes';
import userRoutes from './userRoutes';
import wishlistRoutes from './wishlistRoutes';

const router = express.Router();

// Default API route
router.get('/', (req, res) => {
  res.json({
    message: 'eCommerce API is running',
    version: '1.0.0',
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/customers', customerRoutes);
router.use('/orders', orderRoutes);
router.use('/products', productRoutes);
router.use('/reviews', reviewRoutes);
router.use('/upload', uploadRoutes);
router.use('/users', userRoutes);
router.use('/wishlists', wishlistRoutes);

export default router;