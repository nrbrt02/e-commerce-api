import { Model, DataTypes, Optional, Association, Transaction } from 'sequelize';
import sequelize from '../config/db';
import bcrypt from 'bcrypt';
import config from '../config/env';
import Role from './Role';

// User attributes interface
export interface UserAttributes {
  id: number;
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for optional attributes during creation
interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'firstName' | 'lastName' | 'avatar' | 'isActive' | 'lastLogin' | 'createdAt' | 'updatedAt'> {}

// Extend the Transaction interface to include the 'finished' property
declare module 'sequelize' {
  interface Transaction {
    finished?: 'commit' | 'rollback';
  }
}

// User model class
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public username!: string;
  public email!: string;
  public password!: string;
  public firstName!: string | undefined;
  public lastName!: string | undefined;
  public avatar!: string | undefined;
  public isActive!: boolean;
  public lastLogin!: Date | undefined;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Define associations
  public readonly roles?: Role[];

  // Standard Sequelize association methods
  public getRoles!: () => Promise<Role[]>;
  public setRoles!: (roles: Role[]) => Promise<void>;
  
  // Add the Sequelize association methods that are being used in the code
  public $get!: <K extends 'roles'>(key: K) => Promise<K extends 'roles' ? Role[] : never>;
  public $add!: <K extends 'roles'>(key: K, values: K extends 'roles' ? Role[] : never, options?: { transaction?: Transaction }) => Promise<void>;
  
  // Method to check if password matches
  public async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  // Helper method to return user data without sensitive information
  public toJSON(): Omit<UserAttributes, 'password'> {
    const values = Object.assign({}, this.get());
    delete (values as any).password;
    return values as Omit<UserAttributes, 'password'>;
  }

  // Method to check if user has a specific role
  public async hasRole(roleName: string): Promise<boolean> {
    const roles = await this.getRoles();
    return roles.some(role => role.name === roleName);
  }

  // Method to check if user has any of the specified roles
  public async hasAnyRole(roleNames: string[]): Promise<boolean> {
    const roles = await this.getRoles();
    return roles.some(role => roleNames.includes(role.name));
  }

  // Method to check if user has a specific permission
  public async hasPermission(permission: string): Promise<boolean> {
    const roles = await this.getRoles();
    return roles.some(role => role.permissions.includes(permission));
  }

  // Helper method to get full name
  public getFullName(): string {
    return [this.firstName, this.lastName].filter(Boolean).join(' ');
  }
  
  // Define associations structure for TypeScript
  public static associations: {
    roles: Association<User, Role>;
  };
}

// Initialize User model
User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    avatar: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    hooks: {
      // Hash password before saving to database
      beforeCreate: async (user: User) => {
        user.password = await bcrypt.hash(user.password, config.bcrypt.saltRounds);
      },
      beforeUpdate: async (user: User) => {
        if ((user as any).changed && (user as any).changed('password')) {
          user.password = await bcrypt.hash(user.password, config.bcrypt.saltRounds);
        }
      },
    },
  }
);

// Create a junction table for User-Role many-to-many relationship
const UserRole = sequelize.define('UserRole', {}, { timestamps: false });

// Define associations
User.belongsToMany(Role, { through: UserRole, as: 'roles' });
Role.belongsToMany(User, { through: UserRole, as: 'users' });

export default User;