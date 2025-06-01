import express from 'express';
import * as customerController from '../controllers/customerController';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../middleware/roleCheck';
import { restrictTo } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Customer profile routes
router.get('/profile', customerController.getProfile);
router.put('/profile', customerController.updateProfile);
router.put('/profile/password', customerController.updatePassword);

// Admin routes
router.get('/', restrictTo('admin'), customerController.getCustomers);
router.get('/:id', restrictTo('admin'), customerController.getCustomerById);
router.put('/:id', hasPermission(['customer:update']), customerController.updateCustomer);
router.delete('/:id', hasPermission(['customer:delete']), customerController.deleteCustomer);
router.put('/:id/password', hasPermission(['customer:update']), customerController.updateCustomerPassword);
router.get('/:id/orders', hasPermission(['customer:view', 'order:view']), customerController.getCustomerOrders);

export default router;