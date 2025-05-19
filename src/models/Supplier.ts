import { Model, DataTypes, Optional, Association, Transaction, Sequelize } from 'sequelize';
import bcrypt from 'bcrypt';
import config from '../config/env';


export interface SupplierAttributes {
  id: number;
  name: string;
  email: string;
  password: string;
  contactPerson: string;
  phone?: string;
  address?: object;
  logoUrl?: string;
  description?: string;
  website?: string;
  tin?: string;
  isVerified: boolean;
  isActive: boolean;
  rating?: number;
  metadata?: object;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for optional attributes during creation
interface SupplierCreationAttributes extends Optional<SupplierAttributes, 
  'id' | 'phone' | 'address' | 'logoUrl' | 'description' | 'website' | 'tin' | 
  'isVerified' | 'isActive' | 'rating' | 'metadata' | 'lastLogin' | 'createdAt' | 'updatedAt'> {}

// Supplier model class
export class Supplier extends Model<SupplierAttributes, SupplierCreationAttributes> implements SupplierAttributes {
  public id!: number;
  public name!: string;
  public email!: string;
  public password!: string;
  public contactPerson!: string;
  public phone?: string;
  public address?: object;
  public logoUrl?: string;
  public description?: string;
  public website?: string;
  public tin?: string;
  public isVerified!: boolean;
  public isActive!: boolean;
  public rating?: number;
  public metadata?: object;
  public lastLogin?: Date;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Method to check if password matches
  public async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  // Helper method to return supplier data without sensitive information
  public toJSON(): Omit<SupplierAttributes, 'password'> {
    const values = Object.assign({}, this.get());
    delete (values as any).password;
    return values as Omit<SupplierAttributes, 'password'>;
  }
}

export default function defineSupplierModel(sequelize: Sequelize): typeof Supplier {
  // Initialize Supplier model
  Supplier.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
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
      contactPerson: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      address: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      logoUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      website: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      tin: {
        type: DataTypes.STRING(50),
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
      rating: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
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
      modelName: 'Supplier',
      tableName: 'suppliers',
      hooks: {
        // Hash password before saving to database
        beforeCreate: async (supplier: Supplier) => {
          supplier.password = await bcrypt.hash(supplier.password, config.bcrypt.saltRounds);
        },
        beforeUpdate: async (supplier: Supplier) => {
          if ((supplier as any).changed && (supplier as any).changed('password')) {
            supplier.password = await bcrypt.hash(supplier.password, config.bcrypt.saltRounds);
          }
        },
      },
    }
  );

  return Supplier;
}