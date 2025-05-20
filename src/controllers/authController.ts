import { Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import { Secret, SignOptions } from "jsonwebtoken";
import asyncHandler from "../utils/asyncHandler";
import { AppError } from "../middleware/errorHandler";
import config from "../config/env";
import models from "../models";

const { User, Customer, Role, Supplier } = models;

/**
 * Login admin/staff
 * @route POST /api/auth/login
 * @access Public
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }
  
  const Model = User;
  
  const user = await Model.findOne({ 
    where: { email },
    include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
  });
  
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }
  
  if (!user.isActive) {
    throw new AppError('Your account is inactive. Please contact support.', 401);
  }
  const isPasswordValid = await user.validatePassword(password);
  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401);
  }
  
  user.lastLogin = new Date();
  await user.save();
  
  const secretKey: Secret = config.jwt.secret;
  const signOptions: SignOptions = { 
    expiresIn: config.jwt.expiresIn as any // Type assertion to fix the error
  };
  
  const userRoles = user.roles.map((role: { name: string }) => role.name);
  const role = userRoles.includes('superadmin') ? 'superadmin' : 'admin';
  
  const token = jwt.sign(
    { id: user.id, role },
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
 * Login supplier
 * @route POST /api/auth/supplier/login
 * @access Public
 */
export const supplierLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }
  
  // Find supplier by email
  const supplier = await Supplier.findOne({
    where: { email }
  });
  
  if (!supplier) {
    throw new AppError('Invalid credentials', 401);
  }
  
  // Check if supplier is active
  if (!supplier.isActive) {
    throw new AppError('Your account is inactive. Please contact support.', 401);
  }
  
  // Validate password
  const isPasswordValid = await supplier.validatePassword(password);
  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401);
  }
  
  // Update last login timestamp
  supplier.lastLogin = new Date();
  await supplier.save();
  
  // Generate JWT token
  const secretKey: Secret = config.jwt.secret;
  const signOptions: SignOptions = { 
    expiresIn: config.jwt.expiresIn as any
  };
  
  const token = jwt.sign(
    { id: supplier.id, role: 'supplier' },
    secretKey,
    signOptions
  );
  
  // Remove password from response
  const supplierData = supplier.toJSON();
  
  res.status(200).json({
    status: 'success',
    token,
    data: {
      supplier: supplierData,
    },
  });
});

/**
 * Register a new admin/supplier
 * @route POST /api/auth/register
 * @access Public (In production, typically restricted to super admins)
 */
export const registerAdmin = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      roleName = "admin",
    } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      throw new AppError("Please provide username, email, and password", 400);
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new AppError("Email already in use", 400);
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      throw new AppError("Username already in use", 400);
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      isVerified: true,
      isActive: true,
      lastLogin: new Date(),
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
      expiresIn: config.jwt.expiresIn as any,
    };

    const token = jwt.sign(
      { id: user.id, role: roleName }, // Use roleName here
      secretKey,
      signOptions
    );

    // Remove password from response
    const userData = user.toJSON();

    res.status(201).json({
      status: "success",
      token,
      data: {
        user: userData,
      },
    });
  }
);

/**
 * Register a new supplier
 * @route POST /api/auth/supplier/register
 * @access Private (Admin only)
 */
export const registerSupplier = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    email,
    password,
    contactPerson,
    phone,
    address,
    website,
    description,
    tin,
    isVerified,
    isActive
  } = req.body;
  
  // Validate required fields
  if (!name || !email || !password || !contactPerson) {
    throw new AppError('Please provide name, email, password, and contact person', 400);
  }
  
  // Check if email already exists
  const existingSupplier = await Supplier.findOne({ where: { email } });
  if (existingSupplier) {
    throw new AppError('Email already in use', 400);
  }
  
  // Create supplier
  const supplier = await Supplier.create({
    name,
    email,
    password, // Will be hashed by model hook
    contactPerson,
    phone,
    address,
    website,
    description,
    tin,
    isVerified: isVerified !== undefined ? isVerified : false,
    isActive: isActive !== undefined ? isActive : true,
  });
  
  // Remove password from response
  const supplierData = supplier.toJSON();
  
  res.status(201).json({
    status: 'success',
    data: {
      supplier: supplierData,
    },
  });
});

/**
 * Register a new customer
 * @route POST /api/auth/customer/register
 * @access Public
 */
export const registerCustomer = asyncHandler(
  async (req: Request, res: Response) => {
    const { username, email, password, firstName, lastName } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      throw new AppError("Please provide username, email, and password", 400);
    }

    // Check if email already exists
    const existingUser = await Customer.findOne({ where: { email } });
    if (existingUser) {
      throw new AppError("Email already in use", 400);
    }

    // Check if username already exists
    const existingUsername = await Customer.findOne({ where: { username } });
    if (existingUsername) {
      throw new AppError("Username already in use", 400);
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
      expiresIn: config.jwt.expiresIn as any, // Type assertion to fix the error
    };

    const token = jwt.sign(
      { id: customer.id, role: "customer" },
      secretKey,
      signOptions
    );

    // Remove password from response
    const customerData = customer.toJSON();

    res.status(201).json({
      status: "success",
      token,
      data: {
        customer: customerData,
      },
    });
  }
);

/**
 * Get current user profile
 * @route GET /api/auth/me
 * @access Private
 */
export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response) => {
    // User is already attached to request by auth middleware
    const user = req.user;

    res.status(200).json({
      status: "success",
      data: {
        user,
      },
    });
  }
);

/**
 * Update password
 * @route PATCH /api/auth/update-password
 * @access Private
 */
export const updateAuthPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      throw new AppError(
        "Please provide current password and new password",
        400
      );
    }

    // Find user based on role
    let user;
    switch(req.user!.role) {
      case "admin":
      case "superadmin":
        user = await User.findByPk(req.user!.id);
        break;
      case "supplier":
        user = await Supplier.findByPk(req.user!.id);
        break;
      case "customer":
        user = await Customer.findByPk(req.user!.id);
        break;
      default:
        throw new AppError("Invalid user role", 400);
    }

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Validate current password
    const isPasswordValid = await user.validatePassword(currentPassword);
    if (!isPasswordValid) {
      throw new AppError("Current password is incorrect", 401);
    }

    // Update password
    user.password = newPassword; // Will be hashed by model hook
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Password updated successfully",
    });
  }
);

/**
 * Forgot password
 * @route POST /api/auth/forgot-password
 * @access Public
 */
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, userType = "customer" } = req.body;

    if (!email) {
      throw new AppError("Please provide an email address", 400);
    }

    // Determine model based on user type
    let Model;
    switch(userType) {
      case "admin":
        Model = User;
        break;
      case "supplier":
        Model = Supplier;
        break;
      case "customer":
        Model = Customer;
        break;
      default:
        throw new AppError("Invalid user type", 400);
    }

    // Find user by email
    const user = await Model.findOne({ where: { email } });

    if (!user) {
      // For security reasons, we don't reveal that the email doesn't exist
      res.status(200).json({
        status: "success",
        message:
          "If your email exists in our system, you will receive a reset link shortly",
      });
      return;
    }

    // Generate reset token - Fixed typing issue with expiresIn
    const secretKey: Secret = config.jwt.secret;
    const signOptions: SignOptions = {
      expiresIn: "1h" as any, // Type assertion to fix the error
    };

    const resetToken = jwt.sign(
      { id: user.id, purpose: "reset_password", role: userType },
      secretKey,
      signOptions
    );

    // In a real app, you would send an email with the reset link
    // For this example, we'll just return the token

    res.status(200).json({
      status: "success",
      message:
        "If your email exists in our system, you will receive a reset link shortly",
      // In development, return token for testing
      ...(process.env.NODE_ENV === "development" && { resetToken }),
    });
  }
);

/**
 * Customer login
 * @route POST /api/auth/customer/login
 * @access Public
 */
export const customerLogin = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      throw new AppError("Please provide email and password", 400);
    }

    // Find customer by email
    const customer = await Customer.findOne({
      where: { email },
    });

    if (!customer) {
      throw new AppError("Invalid credentials", 401);
    }

    // Check if customer is active
    if (!customer.isActive) {
      throw new AppError(
        "Your account is inactive. Please contact support.",
        401
      );
    }

    // Validate password
    const isPasswordValid = await customer.validatePassword(password);
    if (!isPasswordValid) {
      throw new AppError("Invalid credentials", 401);
    }

    // Update last login timestamp
    customer.lastLogin = new Date();
    await customer.save();

    // Generate JWT token
    const secretKey: Secret = config.jwt.secret;
    const signOptions: SignOptions = {
      expiresIn: config.jwt.expiresIn as any, // Type assertion to fix the error
    };

    const token = jwt.sign(
      { id: customer.id, role: "customer" },
      secretKey,
      signOptions
    );

    // Remove password from response
    const customerData = customer.toJSON();

    res.status(200).json({
      status: "success",
      token,
      data: {
        customer: customerData,
      },
    });
  }
);

/**
 * Reset password
 * @route POST /api/auth/reset-password
 * @access Public (with token)
 */
export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { token, newPassword, userType = "customer" } = req.body;

    if (!token || !newPassword) {
      throw new AppError("Please provide a token and new password", 400);
    }

    try {
      // Verify reset token - fixed typing issue
      const secretKey: Secret = config.jwt.secret;
      const decoded = jwt.verify(token, secretKey) as {
        id: number;
        purpose: string;
        role: string;
      };

      if (decoded.purpose !== "reset_password") {
        throw new AppError("Invalid token", 400);
      }

      // Determine model based on role from token
      let Model;
      switch(decoded.role) {
        case "admin":
          Model = User;
          break;
        case "supplier":
          Model = Supplier;
          break;
        case "customer":
          Model = Customer;
          break;
        default:
          throw new AppError("Invalid user type in token", 400);
      }

      // Find user by ID
      const user = await Model.findByPk(decoded.id);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Update password
      user.password = newPassword; // Will be hashed by model hook
      await user.save();

      res.status(200).json({
        status: "success",
        message: "Password reset successfully",
      });
    } catch (error) {
      throw new AppError("Invalid or expired token", 400);
    }
  }
);

export default {
  login,
  supplierLogin,
  registerAdmin,
  registerSupplier,
  registerCustomer,
  getCurrentUser,
  updateAuthPassword,
  forgotPassword,
  customerLogin,
  resetPassword
};