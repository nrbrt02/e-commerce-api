import { Request, Response } from 'express';
import * as authService from '../services/authService';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
export const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, firstName, lastName, roleName } = req.body;

  // Validate required fields
  if (!username || !email || !password || !roleName) {
    throw new AppError('Please provide username, email, password and role', 400);
  }

  // Register user
  const result = await authService.registerUser({
    username,
    email,
    password,
    firstName,
    lastName,
    roleName,
  });

  res.status(201).json({
    status: 'success',
    data: result,
  });
});

/**
 * Register a new customer
 * @route POST /api/auth/customer/register
 * @access Public
 */
export const registerCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, firstName, lastName, phone } = req.body;

  // Validate required fields
  if (!username || !email || !password) {
    throw new AppError('Please provide username, email and password', 400);
  }

  // Register customer
  const result = await authService.registerCustomer({
    username,
    email,
    password,
    firstName,
    lastName,
    phone,
  });

  res.status(201).json({
    status: 'success',
    data: result,
  });
});

/**
 * Login a user
 * @route POST /api/auth/login
 * @access Public
 */
export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }

  // Login user
  const result = await authService.login({
    email,
    password,
    isCustomer: false,
  });

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * Login a customer
 * @route POST /api/auth/customer/login
 * @access Public
 */
export const loginCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }

  // Login customer
  const result = await authService.login({
    email,
    password,
    isCustomer: true,
  });

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * Get current user profile
 * @route GET /api/auth/me
 * @access Private
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  // User is attached to the request object from the authentication middleware
  const user = req.user;

  if (!user) {
    throw new AppError('Not authenticated', 401);
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: user.toJSON(),
    },
  });
});