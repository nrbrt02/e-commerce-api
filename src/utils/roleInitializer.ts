import db from '../models';
import logger from '../config/logger';

// Define standard permissions by resource
const permissions = {
  user: ['view', 'create', 'update', 'delete'],
  customer: ['view', 'create', 'update', 'delete'],
  product: ['view', 'create', 'update', 'delete'],
  category: ['view', 'create', 'update', 'delete'],
  order: ['view', 'create', 'update', 'delete', 'process', 'cancel'],
  dashboard: ['view'],
  reports: ['view', 'export'],
  settings: ['view', 'update'],
};

// Format permissions into strings like "user:view"
const formatPermissions = (rolePermissions: Record<string, string[]>): string[] => {
  const formattedPermissions: string[] = [];
  
  Object.entries(rolePermissions).forEach(([resource, actions]) => {
    actions.forEach(action => {
      formattedPermissions.push(`${resource}:${action}`);
    });
  });
  
  return formattedPermissions;
};

// Define the default roles and their permissions
const defaultRoles = [
  {
    name: 'admin',
    description: 'System administrator with full access',
    permissions: formatPermissions(permissions),
  },
  {
    name: 'supplier',
    description: 'Supplier with limited access to products and orders',
    permissions: formatPermissions({
      product: ['view', 'create', 'update'],
      category: ['view'],
      order: ['view'],
      dashboard: ['view'],
    }),
  },
  {
    name: 'customer',
    description: 'Customer role with access to own data only',
    permissions: formatPermissions({
      // Customers typically don't need explicit permissions in the system
      // as they are authenticated through a separate mechanism
    }),
  },
];

// Get the Role model from db
const Role = db.Role;

// Define the Role type interface
interface RoleAttributes {
  id?: number;
  name: string;
  description: string;
  permissions: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Define Role instance interface
interface RoleInstance extends RoleAttributes {
  update: (values: Partial<RoleAttributes>) => Promise<any>;
}

/**
 * Initialize roles in the database
 */
export const initializeRoles = async (): Promise<void> => {
  try {
    for (const roleData of defaultRoles) {
      const [role, created] = await Role.findOrCreate({
        where: { name: roleData.name },
        defaults: roleData,
      });
      
      // If role exists but permissions changed, update them
      if (!created) {
        // Update permissions if they've changed
        if (JSON.stringify(role.permissions) !== JSON.stringify(roleData.permissions)) {
          await role.update({ permissions: roleData.permissions });
          logger.info(`Updated permissions for role: ${role.name}`);
        }
      } else {
        logger.info(`Created role: ${role.name}`);
      }
    }
    
    logger.info('Roles initialized successfully');
  } catch (error) {
    logger.error('Error initializing roles:', error);
    throw error;
  }
};

/**
 * Get role by name
 */
export const getRoleByName = async (name: string): Promise<RoleInstance | null> => {
  return Role.findOne({ where: { name } });
};

/**
 * Create a custom role with specified permissions
 */
export const createCustomRole = async (
  name: string,
  description: string,
  rolePermissions: Record<string, string[]>
): Promise<RoleInstance> => {
  const formattedPermissions = formatPermissions(rolePermissions);
  
  const [role, created] = await Role.findOrCreate({
    where: { name },
    defaults: {
      name,
      description,
      permissions: formattedPermissions,
    },
  });
  
  if (!created) {
    throw new Error(`Role with name ${name} already exists`);
  }
  
  return role;
};