import express from 'express';
import * as customerController from '../controllers/customerController';
import { authenticate } from '../middleware/auth';
import { hasRole, hasPermission } from '../middleware/roleCheck';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Customer profile routes
router.get('/profile', customerController.getProfile);
router.put('/profile', customerController.updateProfile);
router.put('/profile/password', customerController.updatePassword);

// Admin routes
router.get('/', hasPermission(['customer:view']), customerController.getCustomers);
router.get('/:id', hasPermission(['customer:view']), customerController.getCustomerById);
router.put('/:id', hasPermission(['customer:update']), customerController.updateCustomer);
router.delete('/:id', hasPermission(['customer:delete']), customerController.deleteCustomer);
router.put('/:id/password', hasPermission(['customer:update']), customerController.updateCustomerPassword);
router.get('/:id/orders', hasPermission(['customer:view', 'order:view']), customerController.getCustomerOrders);

export default router;