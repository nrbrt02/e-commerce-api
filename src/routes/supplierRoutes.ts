import express from 'express';
import * as supplierController from '../controllers/supplierController';
import { authenticate, protect, restrictTo } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Public routes (with optional authentication)
router.get('/:id/products', supplierController.getSupplierProducts);

// Admin only routes
router.route('/')
  .get(restrictTo('admin'), supplierController.getSuppliers)
  .post(restrictTo('admin'), supplierController.createSupplier);

// Admin and supplier routes (with access control in the controller)
router.route('/:id')
  .get(supplierController.getSupplierById)
  .put(supplierController.updateSupplier)
  .delete(restrictTo('admin'), supplierController.deleteSupplier);

router.route('/:id/password')
  .put(supplierController.updateSupplierPassword);

router.route('/:id/orders')
  .get(supplierController.getSupplierOrders);
  
router.route('/:id/stats')
  .get(supplierController.getSupplierStats);

export default router;