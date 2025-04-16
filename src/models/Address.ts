import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';
import Customer from './Customer';

// Address types
export enum AddressType {
  SHIPPING = 'shipping',
  BILLING = 'billing',
  BOTH = 'both'
}

// Address attributes interface
export interface AddressAttributes {
  id: number;
  customerId: number;
  firstName: string;
  lastName: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
  type: AddressType;
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for optional attributes during creation
interface AddressCreationAttributes extends Optional<AddressAttributes, 
  'id' | 'company' | 'addressLine2' | 'phone' | 'isDefault' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// Address model class
class Address extends Model<AddressAttributes, AddressCreationAttributes> implements AddressAttributes {
  public id!: number;
  public customerId!: number;
  public firstName!: string;
  public lastName!: string;
  public company?: string;
  public addressLine1!: string;
  public addressLine2?: string;
  public city!: string;
  public state!: string;
  public postalCode!: string;
  public country!: string;
  public phone?: string;
  public isDefault!: boolean;
  public type!: AddressType;
  public metadata?: object;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Helper method to get formatted address
  public getFormattedAddress(): string {
    const parts = [
      this.company,
      `${this.firstName} ${this.lastName}`,
      this.addressLine1,
      this.addressLine2,
      `${this.city}, ${this.state} ${this.postalCode}`,
      this.country
    ];
    return parts.filter(Boolean).join('\n');
  }

  // Helper method to get full name
  public getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}

// Initialize Address model
Address.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'customers',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    company: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    addressLine1: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    addressLine2: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    postalCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    type: {
      type: DataTypes.ENUM(...Object.values(AddressType)),
      allowNull: false,
      defaultValue: AddressType.SHIPPING,
    },
    metadata: {
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
    modelName: 'Address',
    tableName: 'addresses',
    hooks: {
      // If this is the first address for the customer, make it default
      afterCreate: async (address: Address) => {
        const count = await Address.count({
          where: { 
            customerId: address.customerId,
            type: address.type 
          }
        });
        
        if (count === 1) {
          await address.update({ isDefault: true });
        } else if (address.isDefault) {
          // If this address is default, ensure no other address is default
          await Address.update(
            { isDefault: false },
            { 
              where: {
                customerId: address.customerId,
                type: address.type,
                id: { [Op.ne]: address.id }
              }
            }
          );
        }
      },
      beforeUpdate: async (address: Address) => {
        // If this address is set as default, update other addresses
        if (address.changed('isDefault') && address.isDefault) {
          await Address.update(
            { isDefault: false },
            { 
              where: {
                customerId: address.customerId,
                type: address.type,
                id: { [Op.ne]: address.id }
              }
            }
          );
        }
      }
    }
  }
);

// Import for Op
import { Op } from 'sequelize';

// Define associations
Address.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

// Changed the association name from 'addresses' to 'customerAddresses' to avoid naming collision
Customer.hasMany(Address, { foreignKey: 'customerId', as: 'customerAddresses' });

export default Address;