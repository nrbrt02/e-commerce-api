import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';
import models from '../models';
import { catchAsync } from '../utils/catchAsync';

const { User: UserModel, Role } = models;

// Define interface for Role to fix TypeScript issues
interface RoleType {
  id: number;
  name: string;
  description: string;
  permissions: string[];
}

/**
 * Get all users
 * @route GET /api/users
 * @access Private/Superadmin
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
 * @access Private/Superadmin
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
 * Change user status (activate/deactivate)
 * @route PATCH /api/users/:id/status
 * @access Private/Superadmin
 */
export const changeUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    throw new AppError('Invalid status value. Expecting boolean.', 400);
  }

  const user = await UserModel.findByPk(req.params.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.isActive = isActive;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: `User has been ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: {
      user: user.toJSON(),
    },
  });
});

/**
 * Create a new user and assign roles
 * @route POST /api/users
 * @access Private/Superadmin
 */
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, firstName, lastName, isActive, roleIds } = req.body;

  // Validate required fields
  if (!username || !email || !password) {
    throw new AppError('Please provide username, email, and password', 400);
  }

  // Check if email already exists
  const existingUser = await UserModel.findOne({ where: { email } });
  if (existingUser) {
    throw new AppError('Email already in use', 400);
  }

  // Check if username already exists
  const existingUsername = await UserModel.findOne({ where: { username } });
  if (existingUsername) {
    throw new AppError('Username already in use', 400);
  }

  // Create user
  const user = await UserModel.create({
    username,
    email,
    password, // Assume hashing via hook
    firstName,
    lastName,
    isActive: isActive !== undefined ? isActive : true,
  });

  // Assign roles: use provided or fallback to admin role
  let rolesToAssign;

  if (Array.isArray(roleIds) && roleIds.length > 0) {
    rolesToAssign = await Role.findAll({ where: { id: roleIds } });
  } else {
    const adminRole = await Role.findOne({ where: { name: 'admin' } });
    if (!adminRole) {
      throw new AppError('Default admin role not found', 500);
    }
    rolesToAssign = [adminRole];
  }

  await user.setRoles(rolesToAssign);

  // Return created user with roles
  const newUser = await UserModel.findByPk(user.id, {
    include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
    attributes: { exclude: ['password'] },
  });

  res.status(201).json({
    status: 'success',
    data: { user: newUser },
  });
});

/**
 * Update a user
 * @route PUT /api/users/:id
 * @access Private/Superadmin
 */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, firstName, lastName, isActive, roleIds } = req.body;
  
  // Find user
  const user = await UserModel.findByPk(req.params.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check if email is being changed and is already in use
  if (email && email !== user.email) {
    const existingUser = await UserModel.findOne({ where: { email } });
    if (existingUser) {
      throw new AppError('Email already in use', 400);
    }
  }

  // Check if username is being changed and is already in use
  if (username && username !== user.username) {
    const existingUsername = await UserModel.findOne({ where: { username } });
    if (existingUsername) {
      throw new AppError('Username already in use', 400);
    }
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
 * @access Private/Superadmin
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
 * @access Private/Superadmin
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

/**
 * Get all admin users (excluding superadmins)
 * @route GET /api/users/admin
 * @access Private/Superadmin
 */
export const getAdminUsers = catchAsync(async (req: Request, res: Response) => {
  // First, let's get all users and then filter by role to debug
  const allUsers = await UserModel.findAll({
    attributes: { exclude: ['password'] },
    include: [{
      model: Role,
      as: 'roles',
      through: { attributes: [] }
    }]
  });

  // Filter users who have admin role
  const adminUsers = allUsers.filter((user: any) => {
    const userRoles = (user as any).roles || [];
    return userRoles.some((role: RoleType) => role.name === 'admin');
  });

  res.status(200).json({
    status: 'success',
    results: adminUsers.length,
    debug: {
      totalUsers: allUsers.length,
      allUsersWithRoles: allUsers.map((user: any) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        roles: (user as any).roles?.map((role: RoleType) => role.name) || []
      }))
    },
    data: {
      users: adminUsers,
    },
  });
});

/**
 * Get a single admin user
 * @route GET /api/users/admin/:id
 * @access Private/Superadmin
 */
export const getAdminUserById = catchAsync(async (req: Request, res: Response) => {
  const user = await UserModel.findByPk(req.params.id, {
    attributes: { exclude: ['password'] },
    include: [{
      model: Role,
      as: 'roles',
      through: { attributes: [] }
    }]
  });
  
  if (!user) {
    throw new AppError('No user found with that ID', 404);
  }

  // Check if user has admin role
  const userRoles = await user.getRoles() as RoleType[];
  const hasAdminRole = userRoles.some((role: RoleType) => role.name === 'admin');
  
  if (!hasAdminRole) {
    throw new AppError('User is not an admin', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

/**
 * Create a new admin user
 * @route POST /api/users/admin
 * @access Private/Superadmin
 */
export const createAdminUser = catchAsync(async (req: Request, res: Response) => {
  const { username, email, password, firstName, lastName, isActive, roleIds } = req.body;

  // Validate required fields
  if (!username || !email || !password) {
    throw new AppError('Please provide username, email, and password', 400);
  }

  // Check if email already exists
  const existingUser = await UserModel.findOne({ where: { email } });
  if (existingUser) {
    throw new AppError('Email already in use', 400);
  }

  // Check if username already exists
  const existingUsername = await UserModel.findOne({ where: { username } });
  if (existingUsername) {
    throw new AppError('Username already in use', 400);
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

  // Find admin role
  const adminRole = await Role.findOne({ where: { name: 'admin' } });
  if (!adminRole) {
    throw new AppError('Admin role not found', 404);
  }

  // Assign admin role to user
  await user.setRoles([adminRole]);

  // Assign additional roles if provided
  if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
    const additionalRoles = await Role.findAll({ where: { id: roleIds } });
    const allRoles = [adminRole, ...additionalRoles.filter((role: any) => role.id !== adminRole.id)];
    await user.setRoles(allRoles);
  }

  // Get user with roles
  const userWithoutPassword = await UserModel.findByPk(user.id, {
    attributes: { exclude: ['password'] },
    include: [{ model: Role, as: 'roles', through: { attributes: [] } }]
  });

  res.status(201).json({
    status: 'success',
    data: {
      user: userWithoutPassword,
    },
  });
});

/**
 * Update an admin user
 * @route PUT /api/users/admin/:id
 * @access Private/Superadmin
 */
export const updateAdminUser = catchAsync(async (req: Request, res: Response) => {
  const { username, email, firstName, lastName, isActive } = req.body;
  
  const user = await UserModel.findByPk(req.params.id, {
    include: [{
      model: Role,
      as: 'roles',
      through: { attributes: [] }
    }]
  });

  if (!user) {
    throw new AppError('No user found with that ID', 404);
  }

  // Check if user has admin role
  const userRoles = await user.getRoles() as RoleType[];
  const hasAdminRole = userRoles.some((role: RoleType) => role.name === 'admin');
  
  if (!hasAdminRole) {
    throw new AppError('User is not an admin', 404);
  }

  // Check if email is being changed and is already in use
  if (email && email !== user.email) {
    const existingUser = await UserModel.findOne({ where: { email } });
    if (existingUser) {
      throw new AppError('Email already in use', 400);
    }
  }

  // Check if username is being changed and is already in use
  if (username && username !== user.username) {
    const existingUsername = await UserModel.findOne({ where: { username } });
    if (existingUsername) {
      throw new AppError('Username already in use', 400);
    }
  }

  // Update fields
  if (username) user.username = username;
  if (email) user.email = email;
  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();

  const updatedUser = await UserModel.findByPk(user.id, {
    attributes: { exclude: ['password'] },
    include: [{ model: Role, as: 'roles', through: { attributes: [] } }]
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

/**
 * Delete an admin user
 * @route DELETE /api/users/admin/:id
 * @access Private/Superadmin
 */
export const deleteAdminUser = catchAsync(async (req: Request, res: Response) => {
  const user = await UserModel.findByPk(req.params.id, {
    include: [{
      model: Role,
      as: 'roles',
      through: { attributes: [] }
    }]
  });

  if (!user) {
    throw new AppError('No user found with that ID', 404);
  }

  // Check if user has admin role
  const userRoles = await user.getRoles() as RoleType[];
  const hasAdminRole = userRoles.some((role: RoleType) => role.name === 'admin');
  
  if (!hasAdminRole) {
    throw new AppError('User is not an admin', 404);
  }

  await user.destroy();

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

/**
 * Update admin password
 * @route PUT /api/users/admin/:id/password
 * @access Private/Superadmin
 */
export const updateAdminPassword = catchAsync(async (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password) {
    throw new AppError('Please provide a password', 400);
  }

  const user = await UserModel.findByPk(req.params.id, {
    include: [{
      model: Role,
      as: 'roles',
      through: { attributes: [] }
    }]
  });
  
  if (!user) {
    throw new AppError('No user found with that ID', 404);
  }

  // Check if user has admin role
  const userRoles = await user.getRoles() as RoleType[];
  const hasAdminRole = userRoles.some((role: RoleType) => role.name === 'admin');
  
  if (!hasAdminRole) {
    throw new AppError('User is not an admin', 404);
  }

  user.password = password; // Will be hashed by model hook
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully',
  });
});