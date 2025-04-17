import express from 'express';
import { 
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  getMyOrders
} from '../controllers';
import { protect, restrictTo } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Customer routes
router.get('/my-orders', restrictTo('customer'), getMyOrders);
router.post('/', restrictTo('customer'), createOrder);
router.patch('/:id/cancel', cancelOrder); // Both admin and customer can cancel

// Admin routes
router.get('/', restrictTo('admin'), getOrders);
router.get('/:id', getOrderById); // Both admin and customer (if their own order)
router.patch('/:id/status', restrictTo('admin'), updateOrderStatus);
router.patch('/:id/payment', restrictTo('admin'), updatePaymentStatus);

export default router;