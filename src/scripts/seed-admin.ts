import bcrypt from 'bcrypt';
import models from '../models';
import config from '../config/env';
import logger from '../config/logger';

const { User, Role, Supplier } = models;

// Define basic permissions for the system
const permissions = [
  // User management
  'user:create', 'user:view', 'user:update', 'user:delete',
  
  // Product management
  'product:create', 'product:view', 'product:update', 'product:delete',
  
  // Order management
  'order:create', 'order:view', 'order:update', 'order:delete',
  
  // Category management
  'category:create', 'category:view', 'category:update', 'category:delete',
  
  // Customer management
  'customer:create', 'customer:view', 'customer:update', 'customer:delete',
  
  // Supplier management
  'supplier:create', 'supplier:view', 'supplier:update', 'supplier:delete',
  
  // Report access
  'report:view',
  
  // Settings management
  'settings:update',
  
  // Customer specific permissions
  'profile:view', 'profile:update',
  'order:place', 'order:history',
  'cart:manage', 'wishlist:manage',
  'review:create', 'review:update',
];

// Define roles with their permissions
const roles = [
  {
    name: 'superadmin',
    description: 'Super Administrator with all permissions',
    permissions: permissions, // All permissions
  },
  {
    name: 'admin',
    description: 'Administrator with most permissions',
    permissions: permissions.filter(p => !p.includes('delete')), // All except delete permissions
  },
  {
    name: 'manager',
    description: 'Manager with product and order management permissions',
    permissions: [
      'product:create', 'product:view', 'product:update',
      'order:view', 'order:update',
      'category:view',
      'customer:view',
      'supplier:view',
      'report:view',
    ],
  },
  {
    name: 'supplier',
    description: 'Supplier with their own product management',
    permissions: [
      'product:create', 'product:view', 'product:update', 'product:delete',
      'order:view',
      'category:view',
      'profile:view', 'profile:update',
    ],
  },
  {
    name: 'customer',
    description: 'Regular customer permissions',
    permissions: [
      'profile:view', 'profile:update',
      'order:place', 'order:history',
      'product:view',
      'cart:manage', 'wishlist:manage',
      'review:create', 'review:update',
    ],
  },
];

// Superadmin user data
const superadminUser = {
  username: 'superadmin',
  email: 'superadmin@example.com',
  password: 'NLrBluwgOqAn',
  firstName: 'Super',
  lastName: 'Admin',
  isActive: true,
};

// Default supplier data
const defaultSupplier = {
  name: 'FastShop Marketplace',
  email: 'marketplace@fastshopping.rw',
  password: 'SupplierPassword123',
  contactPerson: 'Market Admin',
  phone: '+ 250788191800',
  description: 'The main marketplace supplier for FastShop',
  website: 'https://fastshopping.rw',
  isVerified: true,
  isActive: true,
};

/**
 * Create roles with associated permissions
 */
const createRoles = async () => {
  try {
    logger.info('Creating roles...');
    
    for (const roleData of roles) {
      // Check if role already exists
      let role = await Role.findOne({ where: { name: roleData.name } });
      
      if (!role) {
        // Create role if it doesn't exist
        role = await Role.create({
          name: roleData.name,
          description: roleData.description,
          permissions: roleData.permissions,
        });
        logger.info(`Created role: ${roleData.name}`);
      } else {
        // Update existing role's permissions if needed
        role.permissions = roleData.permissions;
        role.description = roleData.description;
        await role.save();
        logger.info(`Updated role: ${roleData.name}`);
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Error creating roles:', error);
    return false;
  }
};

/**
 * Create superadmin user
 */
const createSuperadminUser = async () => {
  try {
    logger.info('Creating superadmin user...');
    
    // Check if superadmin already exists
    const existingUser = await User.findOne({ 
      where: { email: superadminUser.email } 
    });
    
    if (existingUser) {
      logger.info('Superadmin user already exists');
      
      // Ensure the superadmin role is assigned
      const superadminRole = await Role.findOne({ where: { name: 'superadmin' } });
      if (superadminRole) {
        // Check if role is already assigned
        const hasRole = await existingUser.hasRole('superadmin');
        if (!hasRole) {
          // Use the addRole association method instead of direct UserRole.create
          await existingUser.addRole(superadminRole);
          logger.info('Assigned superadmin role to existing user');
        }
      }
      
      return true;
    }
    
    // Create superadmin user
    const user = await User.create(superadminUser);
    
    logger.info(`Created superadmin user with ID: ${user.id}`);
    
    // Assign superadmin role to user
    const superadminRole = await Role.findOne({ where: { name: 'superadmin' } });
    if (superadminRole) {
      // Use the addRole association method instead of direct UserRole.create
      await user.addRole(superadminRole);
      logger.info('Assigned superadmin role to user');
    }
    
    return true;
  } catch (error) {
    logger.error('Error creating superadmin user:', error);
    return false;
  }
};

/**
 * Create default supplier
 */
const createDefaultSupplier = async () => {
  try {
    logger.info('Creating default supplier...');
    
    // Check if default supplier already exists
    const existingSupplier = await Supplier.findOne({ 
      where: { email: defaultSupplier.email } 
    });
    
    if (existingSupplier) {
      logger.info('Default supplier already exists');
      return true;
    }
    
    // Create default supplier
    const supplier = await Supplier.create(defaultSupplier);
    
    logger.info(`Created default supplier with ID: ${supplier.id}`);
    
    return true;
  } catch (error) {
    logger.error('Error creating default supplier:', error);
    return false;
  }
};

/**
 * Main seed function
 */
export const seedAdminAndRoles = async () => {
  try {
    logger.info('Starting admin and roles seeding process...');
    
    // Create roles with permissions
    const rolesCreated = await createRoles();
    if (!rolesCreated) {
      throw new Error('Failed to create roles');
    }
    
    // Create superadmin user
    const superadminCreated = await createSuperadminUser();
    if (!superadminCreated) {
      throw new Error('Failed to create superadmin user');
    }
    
    // Create default supplier
    const supplierCreated = await createDefaultSupplier();
    if (!supplierCreated) {
      throw new Error('Failed to create default supplier');
    }
    
    logger.info('Admin, roles and default supplier seeding completed successfully');
    return true;
  } catch (error) {
    logger.error('Admin and roles seeding failed:', error);
    return false;
  }
};

// Export a function to run the script directly
export const runSeed = async () => {
  try {
    await seedAdminAndRoles();
    process.exit(0);
  } catch (error) {
    logger.error('Seed script failed:', error);
    process.exit(1);
  }
};

// Run the seed if this script is executed directly
if (require.main === module) {
  runSeed();
}