// services/authService.ts
import User from '../models/User';
import Customer from '../models/Customer';
import Role from '../models/Role';
import { AppError } from '../middleware/errorHandler';
import { generateToken } from '../middleware/auth';
import logger from '../config/logger';
import sequelize from '../config/db';

/**
 * Interface for user registration data
 */
export interface RegisterUserData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  roleName: string;
}

/**
 * Interface for customer registration data
 */
export interface RegisterCustomerData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/**
 * Interface for login data
 */
export interface LoginData {
  email: string;
  password: string;
  isCustomer?: boolean;
}

/**
 * Interface for auth response
 */
export interface AuthResponse {
  user: {
    id: number;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    roles?: string[];
  };
  token: string;
}

/**
 * Register a new user
 */
export const registerUser = async (userData: RegisterUserData): Promise<AuthResponse> => {
  const transaction = await sequelize.transaction();
  
  try {
    // Check if email already exists
    const existingUser = await User.findOne({ 
      where: { email: userData.email },
      transaction
    });
    
    if (existingUser) {
      await transaction.rollback();
      throw new AppError('Email already in use', 400);
    }
    
    // Get the role
    const role = await getRoleByName(userData.roleName);
    
    if (!role) {
      await transaction.rollback();
      throw new AppError(`Role '${userData.roleName}' not found`, 400);
    }
    
    // Create the user
    const user = await User.create({
      username: userData.username,
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
    }, { transaction });
    
    // Assign role to user
    await user.$add('roles', [role], { transaction });
    
    // Commit transaction
    await transaction.commit();
    
    // Get user with roles
    const userWithRoles = await User.findByPk(user.id, {
      include: [{ model: Role, as: 'roles' }]
    });
    
    if (!userWithRoles) {
      throw new AppError('Error retrieving user data', 500);
    }
    
    const roles = await userWithRoles.$get('roles');
    
    // Generate JWT token
    const token = generateToken(user.id);
    
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        roles: roles.map((r: Role) => r.name),
      },
      token
    };
  } catch (error) {
    if (transaction.finished !== 'commit') {
      await transaction.rollback();
    }
    
    if (error instanceof AppError) {
      throw error;
    }
    
    logger.error('User registration error:', error);
    throw new AppError('User registration failed', 500);
  }
};

/**
 * Register a new customer
 */
export const registerCustomer = async (customerData: RegisterCustomerData): Promise<AuthResponse> => {
  try {
    // Check if email already exists
    const existingCustomer = await Customer.findOne({ where: { email: customerData.email } });
    
    if (existingCustomer) {
      throw new AppError('Email already in use', 400);
    }
    
    // Create the customer
    const customer = await Customer.create({
      username: customerData.username,
      email: customerData.email,
      password: customerData.password,
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      phone: customerData.phone,
    });
    
    // Generate JWT token
    const token = generateToken(customer.id);
    
    return {
      user: {
        id: customer.id,
        username: customer.username,
        email: customer.email,
        firstName: customer.firstName || undefined,
        lastName: customer.lastName || undefined,
      },
      token
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    
    logger.error('Customer registration error:', error);
    throw new AppError('Customer registration failed', 500);
  }
};

/**
 * Login a user or customer
 */
export const login = async (loginData: LoginData): Promise<AuthResponse> => {
  try {
    let user;
    let roles: string[] = [];
    
    if (loginData.isCustomer) {
      // Customer login
      user = await Customer.findOne({ where: { email: loginData.email } });
      
      if (!user) {
        throw new AppError('Invalid email or password', 401);
      }
      
      const isPasswordValid = await user.validatePassword(loginData.password);
      
      if (!isPasswordValid) {
        throw new AppError('Invalid email or password', 401);
      }
      
      if (!user.isActive) {
        throw new AppError('Your account has been deactivated', 403);
      }
      
      // Update last login
      await user.update({ lastLogin: new Date() });
    } else {
      // User login
      user = await User.findOne({ 
        where: { email: loginData.email },
        include: [{ model: Role, as: 'roles' }]
      });
      
      if (!user) {
        throw new AppError('Invalid email or password', 401);
      }
      
      const isPasswordValid = await user.validatePassword(loginData.password);
      
      if (!isPasswordValid) {
        throw new AppError('Invalid email or password', 401);
      }
      
      if (!user.isActive) {
        throw new AppError('Your account has been deactivated', 403);
      }
      
      // Get roles
      const userRoles = await user.$get('roles');
      roles = userRoles.map((role: Role) => role.name);
      
      // Update last login
      await user.update({ lastLogin: new Date() });
    }
    
    // Generate JWT token
    const token = generateToken(user.id);
    
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        roles: roles.length > 0 ? roles : undefined,
      },
      token
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    
    logger.error('Login error:', error);
    throw new AppError('Login failed', 500);
  }
};

// Helper function for role retrieval (imported from roleInitializer)
import { getRoleByName } from '../utils/roleInitializer';