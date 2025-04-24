import express from 'express';
import { 
  registerAdmin,
  registerCustomer, 
  getCurrentUser, 
  updateAuthPassword,
  forgotPassword, 
  resetPassword,
  customerLogin,
  login 
} from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', registerAdmin);
router.post('/customer/register', registerCustomer);
router.post('/login', login);
router.post('/customer/login', customerLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.use(protect);
router.get('/me', getCurrentUser);
router.patch('/update-password', updateAuthPassword);

export default router;