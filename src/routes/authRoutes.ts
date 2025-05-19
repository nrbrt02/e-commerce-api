import express from 'express';
import { 
  registerAdmin,
  registerCustomer,
  registerSupplier,
  getCurrentUser, 
  updateAuthPassword,
  forgotPassword, 
  resetPassword,
  customerLogin,
  supplierLogin,
  login 
} from '../controllers/authController';
import { protect, restrictTo } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', registerAdmin);
router.post('/customer/register', registerCustomer);
router.post('/supplier/register', restrictTo('admin'), registerSupplier); // Admin only
router.post('/login', login);
router.post('/customer/login', customerLogin);
router.post('/supplier/login', supplierLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.use(protect);
router.get('/me', getCurrentUser);
router.patch('/update-password', updateAuthPassword);

export default router;