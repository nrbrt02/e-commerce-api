import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';
import bcrypt from 'bcrypt';
import config from '../config/env';

// Customer attributes interface
export interface CustomerAttributes {
  id: number;
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  phone?: string;
  isVerified: boolean;
  isActive: boolean;
  lastLogin?: Date;
  addresses?: object[];
  preferences?: object;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for optional attributes during creation
interface CustomerCreationAttributes extends Optional<CustomerAttributes, 
  'id' | 'firstName' | 'lastName' | 'avatar' | 'phone' | 'isVerified' | 'isActive' | 
  'lastLogin' | 'addresses' | 'preferences' | 
  'createdAt' | 'updatedAt'> {}

// Customer model class
class Customer extends Model<CustomerAttributes, CustomerCreationAttributes> implements CustomerAttributes {
  public id!: number;
  public username!: string;
  public email!: string;
  public password!: string;
  public firstName!: string | undefined;
  public lastName!: string | undefined;
  public avatar!: string | undefined;
  public phone!: string | undefined;
  public isVerified!: boolean;
  public isActive!: boolean;
  public lastLogin!: Date | undefined;
  public addresses!: object[] | undefined;
  public preferences!: object | undefined;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Method to check if password matches
  public async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  // Helper method to return customer data without sensitive information
  public toJSON(): Omit<CustomerAttributes, 'password'> {
    const values = Object.assign({}, this.get());
    delete (values as any).password;
    return values as Omit<CustomerAttributes, 'password'>;
  }

  // Helper method to get full name
  public getFullName(): string {
    return [this.firstName, this.lastName].filter(Boolean).join(' ');
  }

  // Helper method to add a new address
  public async addAddress(address: object): Promise<void> {
    const addresses = this.addresses || [];
    this.addresses = [...addresses, address];
    await this.save();
  }

  // Helper method to update an address by index
  public async updateAddress(index: number, address: object): Promise<boolean> {
    if (!this.addresses || index >= this.addresses.length) {
      return false;
    }
    
    const addresses = [...this.addresses];
    addresses[index] = { ...addresses[index], ...address };
    this.addresses = addresses;
    await this.save();
    return true;
  }

  // Helper method to remove an address by index
  public async removeAddress(index: number): Promise<boolean> {
    if (!this.addresses || index >= this.addresses.length) {
      return false;
    }
    
    const addresses = [...this.addresses];
    addresses.splice(index, 1);
    this.addresses = addresses;
    await this.save();
    return true;
  }
}

// Initialize Customer model
Customer.init(
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
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    addresses: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    preferences: {
      type: DataTypes.JSONB,
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
    modelName: 'Customer',
    tableName: 'customers',
    hooks: {
      // Hash password before saving to database
      beforeCreate: async (customer: Customer) => {
        customer.password = await bcrypt.hash(customer.password, config.bcrypt.saltRounds);
      },
      beforeUpdate: async (customer: Customer) => {
        if ((customer as any).changed && (customer as any).changed('password')) {
          customer.password = await bcrypt.hash(customer.password, config.bcrypt.saltRounds);
        }
      },
    },
  }
);

export default Customer;