import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';
import models from '../models';

const { Customer, Order } = models;

/**
 * Get all customers
 * @route GET /api/customers
 * @access Private (Admin)
 */
export const getCustomers = asyncHandler(async (req: Request, res: Response) => {
  // Build query
  const queryBuilder: any = {
    attributes: { exclude: ['password'] },
  };
  
  // Filter by verified status
  if (req.query.verified) {
    queryBuilder.where = {
      ...queryBuilder.where,
      isVerified: req.query.verified === 'true',
    };
  }
  
  // Filter by active status
  if (req.query.active) {
    queryBuilder.where = {
      ...queryBuilder.where,
      isActive: req.query.active === 'true',
    };
  }
  
  // Pagination
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  
  queryBuilder.limit = limit;
  queryBuilder.offset = offset;
  
  // Sorting
  const sortField = req.query.sortBy || 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  queryBuilder.order = [[sortField as string, sortOrder]];
  
  // Execute query
  const { count, rows: customers } = await Customer.findAndCountAll(queryBuilder);
  
  // Calculate pagination info
  const totalPages = Math.ceil(count / limit);
  
  res.status(200).json({
    status: 'success',
    results: customers.length,
    pagination: {
      totalCustomers: count,
      totalPages,
      currentPage: page,
      limit,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
    data: {
      customers,
    },
  });
});

/**
 * Get a single customer
 * @route GET /api/customers/:id
 * @access Private (Admin)
 */
export const getCustomerById = asyncHandler(async (req: Request, res: Response) => {
  const customer = await Customer.findByPk(req.params.id, {
    attributes: { exclude: ['password'] },
  });

  if (!customer) {
    throw new AppError('Customer not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      customer,
    },
  });
});

/**
 * Update a customer (admin)
 * @route PUT /api/customers/:id
 * @access Private (Admin)
 */
export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const {
    username,
    email,
    firstName,
    lastName,
    phone,
    isVerified,
    isActive,
  } = req.body;
  
  // Find customer
  const customer = await Customer.findByPk(req.params.id);
  
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }
  
  // Update fields
  if (username) customer.username = username;
  if (email) customer.email = email;
  if (firstName !== undefined) customer.firstName = firstName;
  if (lastName !== undefined) customer.lastName = lastName;
  if (phone !== undefined) customer.phone = phone;
  if (isVerified !== undefined) customer.isVerified = isVerified;
  if (isActive !== undefined) customer.isActive = isActive;
  
  await customer.save();
  
  res.status(200).json({
    status: 'success',
    data: {
      customer: {
        ...customer.toJSON(),
      },
    },
  });
});

/**
 * Update customer password (admin)
 * @route PUT /api/customers/:id/password
 * @access Private (Admin)
 */
export const updateCustomerPassword = asyncHandler(async (req: Request, res: Response) => {
  const { password } = req.body;
  
  if (!password) {
    throw new AppError('Please provide a password', 400);
  }
  
  // Find customer
  const customer = await Customer.findByPk(req.params.id);
  
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }
  
  // Update password
  customer.password = password; // Will be hashed by model hook
  await customer.save();
  
  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully',
  });
});

/**
 * Delete a customer
 * @route DELETE /api/customers/:id
 * @access Private (Admin)
 */
export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await Customer.findByPk(req.params.id);
  
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }
  
  await customer.destroy();
  
  res.status(200).json({
    status: 'success',
    data: null,
  });
});

/**
 * Get customer profile
 * @route GET /api/customers/profile
 * @access Private (Customer)
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  // User is attached to the request object from the authentication middleware
  const customerId = req.user!.id;
  
  const customer = await Customer.findByPk(customerId, {
    attributes: { exclude: ['password'] },
  });
  
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      customer,
    },
  });
});

/**
 * Update customer profile
 * @route PUT /api/customers/profile
 * @access Private (Customer)
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  
  const {
    username,
    firstName,
    lastName,
    phone,
    addresses, // Changed from shippingAddresses and billingAddresses
    preferences,
  } = req.body;
  
  // Find customer
  const customer = await Customer.findByPk(customerId);
  
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }
  
  // Update fields
  if (username) customer.username = username;
  if (firstName !== undefined) customer.firstName = firstName;
  if (lastName !== undefined) customer.lastName = lastName;
  if (phone !== undefined) customer.phone = phone;
  if (addresses) customer.addresses = addresses; // Update addresses array
  if (preferences) customer.preferences = preferences;
  
  await customer.save();
  
  res.status(200).json({
    status: 'success',
    data: {
      customer: {
        ...customer.toJSON(),
      },
    },
  });
});

/**
 * Update customer password
 * @route PUT /api/customers/profile/password
 * @access Private (Customer)
 */
export const updatePassword = asyncHandler(async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    throw new AppError('Please provide current password and new password', 400);
  }
  
  // Find customer
  const customer = await Customer.findByPk(customerId);
  
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }
  
  // Verify current password
  const isPasswordValid = await customer.validatePassword(currentPassword);
  
  if (!isPasswordValid) {
    throw new AppError('Current password is incorrect', 401);
  }
  
  // Update password
  customer.password = newPassword; // Will be hashed by model hook
  await customer.save();
  
  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully',
  });
});

/**
 * Get customer orders
 * @route GET /api/customers/:id/orders
 * @access Private (Admin)
 */
export const getCustomerOrders = asyncHandler(async (req: Request, res: Response) => {
  const customerId = req.params.id;
  
  // Check if customer exists
  const customer = await Customer.findByPk(customerId);
  
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }
  
  // Get customer orders
  const orders = await Order.findAll({
    where: { customerId },
    include: [{
      model: Customer,
      as: 'customer',
      attributes: ['id', 'username', 'email', 'firstName', 'lastName'],
    }],
  });
  
  res.status(200).json({
    status: 'success',
    results: orders.length,
    data: {
      orders,
    },
  });
});