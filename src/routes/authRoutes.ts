import express from 'express';
import * as authController from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', authController.registerUser);
router.post('/customer/register', authController.registerCustomer);
router.post('/login', authController.loginUser);
router.post('/customer/login', authController.loginCustomer);

// Protected routes
router.get('/me', authenticate, authController.getMe);

export default router;