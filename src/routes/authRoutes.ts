import express from 'express';
import { 
  registerAdmin,
  registerCustomer, 
  login, 
  getCurrentUser, 
  updateAuthPassword as updatePassword, 
  forgotPassword, 
  resetPassword 
} from '../controllers';
import { protect } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', registerAdmin); // For admin/supplier registration
router.post('/customer/register', registerCustomer); // For customer registration
router.post('/login', login);
router.post('/customer/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.use(protect); // Middleware to protect routes below
router.get('/me', getCurrentUser);
router.patch('/update-password', updatePassword);

export default router;