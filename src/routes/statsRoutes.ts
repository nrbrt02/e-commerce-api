import express from 'express';
import statsController from '../controllers/StatsController';
import { authenticate, restrictTo } from "../middleware/auth";

const router = express.Router();

// Admin dashboard statistics
router.get(
  '/business',
  authenticate,
  restrictTo('admin'),
  statsController.getBusinessStats
);

// Supplier statistics
router.get(
  '/suppliers',
  authenticate,
  restrictTo('admin'),
  statsController.getSupplierStats
);

// Inventory statistics
router.get(
  '/inventory',
  authenticate,
  restrictTo('admin'),
  statsController.getInventoryStats
);

export default router;