import express from 'express';
import * as orderController from '../controllers/orderController';
import { authenticate } from '../middleware/auth';
import { hasRole, hasPermission } from '../middleware/roleCheck';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Customer routes
router.get('/my-orders', orderController.getMyOrders);
router.post('/', orderController.createOrder);
router.patch('/:id/cancel', orderController.cancelOrder);

// Admin routes
router.get('/', hasPermission(['order:view']), orderController.getOrders);
router.get('/:id', hasPermission(['order:view']), orderController.getOrderById);
router.patch('/:id/status', hasPermission(['order:update']), orderController.updateOrderStatus);
router.patch('/:id/payment', hasPermission(['order:update']), orderController.updatePaymentStatus);

export default router;