import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';
import models from '../models';
import User from '../models/User';
import { catchAsync } from '../utils/catchAsync';

const { User: UserModel, Role } = models;

/**
 * Get all users
 * @route GET /api/users
 * @access Private/Admin
 */
export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await UserModel.findAll({
    include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
    attributes: { exclude: ['password'] },
  });

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users,
    },
  });
});

/**
 * Get a single user
 * @route GET /api/users/:id
 * @access Private/Admin
 */
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findByPk(req.params.id, {
    include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
    attributes: { exclude: ['password'] },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

/**
 * Create a new user
 * @route POST /api/users
 * @access Private/Admin
 */
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, firstName, lastName, isActive, roleIds } = req.body;

  // Check if email already exists
  const existingUser = await UserModel.findOne({ where: { email } });
  if (existingUser) {
    throw new AppError('Email already in use', 400);
  }

  // Create user
  const user = await UserModel.create({
    username,
    email,
    password, // Password will be hashed by model hook
    firstName,
    lastName,
    isActive: isActive !== undefined ? isActive : true,
  });

  // Assign roles if provided
  if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
    const roles = await Role.findAll({ where: { id: roleIds } });
    await user.setRoles(roles);
  }

  // Get user with roles
  const newUser = await UserModel.findByPk(user.id, {
    include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
    attributes: { exclude: ['password'] },
  });

  res.status(201).json({
    status: 'success',
    data: {
      user: newUser,
    },
  });
});

/**
 * Update a user
 * @route PUT /api/users/:id
 * @access Private/Admin
 */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, firstName, lastName, isActive, roleIds } = req.body;
  
  // Find user
  const user = await UserModel.findByPk(req.params.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  // Update user fields
  if (username) user.username = username;
  if (email) user.email = email;
  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (isActive !== undefined) user.isActive = isActive;
  
  await user.save();
  
  // Update roles if provided
  if (roleIds && Array.isArray(roleIds)) {
    const roles = await Role.findAll({ where: { id: roleIds } });
    await user.setRoles(roles);
  }
  
  // Get updated user with roles
  const updatedUser = await UserModel.findByPk(user.id, {
    include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
    attributes: { exclude: ['password'] },
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

/**
 * Update user password
 * @route PUT /api/users/:id/password
 * @access Private/Admin
 */
export const updateUserPassword = asyncHandler(async (req: Request, res: Response) => {
  const { password } = req.body;
  
  if (!password) {
    throw new AppError('Please provide a password', 400);
  }
  
  // Find user
  const user = await UserModel.findByPk(req.params.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  // Update password
  user.password = password; // Will be hashed by model hook
  await user.save();
  
  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully',
  });
});

/**
 * Delete a user
 * @route DELETE /api/users/:id
 * @access Private/Admin
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findByPk(req.params.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  await user.destroy();
  
  res.status(200).json({
    status: 'success',
    data: null,
  });
});

// Get all admin users (excluding superadmins)
export const getAdminUsers = catchAsync(async (req: Request, res: Response) => {
  const users = await UserModel.findAll({
    where: { role: 'admin' },
    attributes: { exclude: ['password'] },
    include: [{ model: Role, as: 'roles', through: { attributes: [] } }]
  });

  res.status(200).json({
    status: 'success',
    data: users,
  });
});

// Get a single admin user
export const getAdminUserById = catchAsync(async (req: Request, res: Response) => {
  const user = await UserModel.findOne({
    where: { id: req.params.id, role: 'admin' },
    attributes: { exclude: ['password'] },
    include: [{ model: Role, as: 'roles', through: { attributes: [] } }]
  });
  
  if (!user) {
    throw new AppError('No admin user found with that ID', 404);
  }

  res.status(200).json({
    status: 'success',
    data: user,
  });
});

// Create a new admin user
export const createAdminUser = catchAsync(async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  const user = await UserModel.create({
    name,
    email,
    password,
    role: 'admin',
  });

  // Remove password from response
  const userWithoutPassword = await UserModel.findByPk(user.id, {
    attributes: { exclude: ['password'] },
    include: [{ model: Role, as: 'roles', through: { attributes: [] } }]
  });

  res.status(201).json({
    status: 'success',
    data: userWithoutPassword,
  });
});

// Update an admin user
export const updateAdminUser = catchAsync(async (req: Request, res: Response) => {
  const { name, email } = req.body;
  
  const user = await UserModel.findOne({
    where: { id: req.params.id, role: 'admin' }
  });

  if (!user) {
    throw new AppError('No admin user found with that ID', 404);
  }

  await user.update({ name, email });

  const updatedUser = await UserModel.findByPk(user.id, {
    attributes: { exclude: ['password'] },
    include: [{ model: Role, as: 'roles', through: { attributes: [] } }]
  });

  res.status(200).json({
    status: 'success',
    data: updatedUser,
  });
});

// Delete an admin user
export const deleteAdminUser = catchAsync(async (req: Request, res: Response) => {
  const user = await UserModel.findOne({
    where: { id: req.params.id, role: 'admin' }
  });

  if (!user) {
    throw new AppError('No admin user found with that ID', 404);
  }

  await user.destroy();

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Update admin password
export const updateAdminPassword = catchAsync(async (req: Request, res: Response) => {
  const { password } = req.body;

  const user = await UserModel.findOne({
    where: { id: req.params.id, role: 'admin' }
  });
  
  if (!user) {
    throw new AppError('No admin user found with that ID', 404);
  }

  await user.update({ password });

  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully',
  });
});