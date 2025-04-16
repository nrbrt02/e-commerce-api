import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';
import Customer from './Customer';
import Product from './Product';

// Wishlist attributes interface
export interface WishlistAttributes {
  id: number;
  customerId: number;
  name: string;
  isPublic: boolean;
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for optional attributes during creation
interface WishlistCreationAttributes extends Optional<WishlistAttributes, 
  'id' | 'name' | 'isPublic' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// Wishlist model class
class Wishlist extends Model<WishlistAttributes, WishlistCreationAttributes> implements WishlistAttributes {
  public id!: number;
  public customerId!: number;
  public name!: string;
  public isPublic!: boolean;
  public metadata?: object;
  public createdAt!: Date;
  public updatedAt!: Date;
}

// WishlistItem attributes interface
export interface WishlistItemAttributes {
  id: number;
  wishlistId: number;
  productId: number;
  addedAt: Date;
  notes?: string;
}

// Interface for optional attributes during creation
interface WishlistItemCreationAttributes extends Optional<WishlistItemAttributes, 
  'id' | 'addedAt' | 'notes'> {}

// WishlistItem model class
class WishlistItem extends Model<WishlistItemAttributes, WishlistItemCreationAttributes> implements WishlistItemAttributes {
  public id!: number;
  public wishlistId!: number;
  public productId!: number;
  public addedAt!: Date;
  public notes?: string;
}

// Initialize Wishlist model
Wishlist.init(
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
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'My Wishlist',
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    modelName: 'Wishlist',
    tableName: 'wishlists',
    hooks: {
      // Create default wishlist for new customers
      afterCreate: async (wishlist: Wishlist) => {
        // If this is the first wishlist for this customer, set it as the default
        const count = await Wishlist.count({
          where: { customerId: wishlist.customerId }
        });
        
        if (count === 1) {
          wishlist.name = 'My Wishlist';
          await wishlist.save();
        }
      }
    }
  }
);

// Initialize WishlistItem model
WishlistItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    wishlistId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'wishlists',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    addedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'WishlistItem',
    tableName: 'wishlist_items',
    timestamps: false,
    indexes: [
      {
        name: 'wishlist_product_idx',
        unique: true,
        fields: ['wishlistId', 'productId'],
      },
    ],
  }
);

// Define associations
Wishlist.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Customer.hasMany(Wishlist, { foreignKey: 'customerId', as: 'wishlists' });

WishlistItem.belongsTo(Wishlist, { foreignKey: 'wishlistId', as: 'wishlist' });
Wishlist.hasMany(WishlistItem, { foreignKey: 'wishlistId', as: 'items' });

WishlistItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(WishlistItem, { foreignKey: 'productId', as: 'wishlistItems' });

export default { Wishlist, WishlistItem };
export { Wishlist, WishlistItem };