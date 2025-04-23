import { Model, DataTypes, Optional, Sequelize } from 'sequelize';

// WishlistItem attributes interface
export interface WishlistItemAttributes {
  id: number;
  wishlistId: number;
  productId: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for optional attributes during creation
interface WishlistItemCreationAttributes extends Optional<WishlistItemAttributes, 
  'id' | 'notes' | 'createdAt' | 'updatedAt'> {}

// WishlistItem model class
export class WishlistItem extends Model<WishlistItemAttributes, WishlistItemCreationAttributes> implements WishlistItemAttributes {
  public id!: number;
  public wishlistId!: number;
  public productId!: number;
  public notes?: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}

export default function defineWishlistItemModel(sequelize: Sequelize): typeof WishlistItem {
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
      notes: {
        type: DataTypes.TEXT,
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
      modelName: 'WishlistItem',
      tableName: 'wishlist_items',
      indexes: [
        {
          unique: true,
          fields: ['wishlistId', 'productId'],
          name: 'wishlist_item_unique',
        },
      ],
    }
  );

  return WishlistItem;
}