import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { Secret, SignOptions } from 'jsonwebtoken';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import config from '../config/env';
import models from '../models';

const { User, Customer, Role } = models;

/**
 * Register a new admin/supplier
 * @route POST /api/auth/register
 * @access Public (In production, typically restricted to super admins)
 */
export const registerAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, firstName, lastName, roleName = 'admin' } = req.body;
  
  // Validate required fields
  if (!username || !email || !password) {
    throw new AppError('Please provide username, email, and password', 400);
  }
  
  // Check if email already exists
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    throw new AppError('Email already in use', 400);
  }
  
  // Check if username already exists
  const existingUsername = await User.findOne({ where: { username } });
  if (existingUsername) {
    throw new AppError('Username already in use', 400);
  }
  
  // Create user
  const user = await User.create({
    username,
    email,
    password, // Will be hashed by model hook
    firstName,
    lastName,
    isVerified: true, // Admin users might be verified by default
    isActive: true,
    lastLogin: new Date()
  });
  
  // Find the role - use roleName from request body
  const userRole = await Role.findOne({ where: { name: roleName } });
  
  if (!userRole) {
    throw new AppError(`Role ${roleName} not found`, 404);
  }
  
  // Associate user with role
  await user.addRole(userRole);
  
  // Generate JWT token
  const secretKey: Secret = config.jwt.secret;
  const signOptions: SignOptions = { 
    expiresIn: config.jwt.expiresIn as any
  };
  
  const token = jwt.sign(
    { id: user.id, role: roleName }, // Use roleName here
    secretKey,
    signOptions
  );
  
  // Remove password from response
  const userData = user.toJSON();
  
  res.status(201).json({
    status: 'success',
    token,
    data: {
      user: userData,
    },
  });
});

/**
 * Register a new customer
 * @route POST /api/auth/customer/register
 * @access Public
 */
export const registerCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, firstName, lastName } = req.body;
  
  // Validate required fields
  if (!username || !email || !password) {
    throw new AppError('Please provide username, email, and password', 400);
  }
  
  // Check if email already exists
  const existingUser = await Customer.findOne({ where: { email } });
  if (existingUser) {
    throw new AppError('Email already in use', 400);
  }
  
  // Check if username already exists
  const existingUsername = await Customer.findOne({ where: { username } });
  if (existingUsername) {
    throw new AppError('Username already in use', 400);
  }
  
  // Create customer
  const customer = await Customer.create({
    username,
    email,
    password, // Will be hashed by model hook
    firstName,
    lastName,
    isVerified: false, // Requires email verification
    isActive: true,
  });
  
  // Generate JWT token - Fixed typing issue with expiresIn
  const secretKey: Secret = config.jwt.secret;
  const signOptions: SignOptions = { 
    expiresIn: config.jwt.expiresIn as any // Type assertion to fix the error
  };
  
  const token = jwt.sign(
    { id: customer.id, role: 'customer' },
    secretKey,
    signOptions
  );
  
  // Remove password from response
  const customerData = customer.toJSON();
  
  res.status(201).json({
    status: 'success',
    token,
    data: {
      customer: customerData,
    },
  });
});

/**
 * Login user or customer
 * @route POST /api/auth/login
 * @access Public
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, userType = 'customer' } = req.body;
  
  // Validate required fields
  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }
  
  // Determine model based on user type
  const Model = userType === 'admin' ? User : Customer;
  
  // Find user by email
  const user = await Model.findOne({ 
    where: { email },
    include: userType === 'admin' ? [{ model: Role, as: 'roles', through: { attributes: [] } }] : [],
  });
  
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }
  
  // Check if user is active
  if (!user.isActive) {
    throw new AppError('Your account is inactive. Please contact support.', 401);
  }
  
  // Validate password
  const isPasswordValid = await user.validatePassword(password);
  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401);
  }
  
  // Update last login timestamp
  user.lastLogin = new Date();
  await user.save();
  
  // Generate JWT token - Fixed typing issue with expiresIn
  const secretKey: Secret = config.jwt.secret;
  const signOptions: SignOptions = { 
    expiresIn: config.jwt.expiresIn as any // Type assertion to fix the error
  };
  
  const token = jwt.sign(
    { id: user.id, role: userType },
    secretKey,
    signOptions
  );
  
  // Remove password from response
  const userData = user.toJSON();
  
  res.status(200).json({
    status: 'success',
    token,
    data: {
      user: userData,
    },
  });
});

/**
 * Get current user profile
 * @route GET /api/auth/me
 * @access Private
 */
export const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  // User is already attached to request by auth middleware
  const user = req.user;
  
  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

/**
 * Update password
 * @route PATCH /api/auth/update-password
 * @access Private
 */
export const updateAuthPassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  
  // Validate required fields
  if (!currentPassword || !newPassword) {
    throw new AppError('Please provide current password and new password', 400);
  }
  
  // Find user (could be admin or customer)
  const Model = req.user!.role === 'admin' ? User : Customer;
  const user = await Model.findByPk(req.user!.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  // Validate current password
  const isPasswordValid = await user.validatePassword(currentPassword);
  if (!isPasswordValid) {
    throw new AppError('Current password is incorrect', 401);
  }
  
  // Update password
  user.password = newPassword; // Will be hashed by model hook
  await user.save();
  
  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully',
  });
});

/**
 * Forgot password
 * @route POST /api/auth/forgot-password
 * @access Public
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, userType = 'customer' } = req.body;
  
  if (!email) {
    throw new AppError('Please provide an email address', 400);
  }
  
  // Determine model based on user type
  const Model = userType === 'admin' ? User : Customer;
  
  // Find user by email
  const user = await Model.findOne({ where: { email } });
  
  if (!user) {
    // For security reasons, we don't reveal that the email doesn't exist
    res.status(200).json({
      status: 'success',
      message: 'If your email exists in our system, you will receive a reset link shortly',
    });
    return;
  }
  
  // Generate reset token - Fixed typing issue with expiresIn
  const secretKey: Secret = config.jwt.secret;
  const signOptions: SignOptions = { 
    expiresIn: '1h' as any // Type assertion to fix the error
  };
  
  const resetToken = jwt.sign(
    { id: user.id, purpose: 'reset_password' },
    secretKey,
    signOptions
  );
  
  // In a real app, you would send an email with the reset link
  // For this example, we'll just return the token
  
  res.status(200).json({
    status: 'success',
    message: 'If your email exists in our system, you will receive a reset link shortly',
    // In development, return token for testing
    ...(process.env.NODE_ENV === 'development' && { resetToken }),
  });
});

/**
 * Reset password
 * @route POST /api/auth/reset-password
 * @access Public (with token)
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword, userType = 'customer' } = req.body;
  
  if (!token || !newPassword) {
    throw new AppError('Please provide a token and new password', 400);
  }
  
  try {
    // Verify reset token - fixed typing issue
    const secretKey: Secret = config.jwt.secret;
    const decoded = jwt.verify(token, secretKey) as { id: number; purpose: string };
    
    if (decoded.purpose !== 'reset_password') {
      throw new AppError('Invalid token', 400);
    }
    
    // Determine model based on user type
    const Model = userType === 'admin' ? User : Customer;
    
    // Find user by ID
    const user = await Model.findByPk(decoded.id);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Update password
    user.password = newPassword; // Will be hashed by model hook
    await user.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Password reset successfully',
    });
  } catch (error) {
    throw new AppError('Invalid or expired token', 400);
  }
});