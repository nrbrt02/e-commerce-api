import { Model, DataTypes, Optional, Sequelize } from 'sequelize';

// Wishlist attributes interface
export interface WishlistAttributes {
  id: number;
  customerId: number;
  name: string;
  description?: string;
  isPublic: boolean;
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for optional attributes during creation
interface WishlistCreationAttributes extends Optional<WishlistAttributes, 
  'id' | 'description' | 'isPublic' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// Wishlist model class
export class Wishlist extends Model<WishlistAttributes, WishlistCreationAttributes> implements WishlistAttributes {
  public id!: number;
  public customerId!: number;
  public name!: string;
  public description?: string;
  public isPublic!: boolean;
  public metadata?: object;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Association methods
  public getProducts!: () => Promise<any[]>;
  public setProducts!: (products: any[]) => Promise<void>;
  public addProduct!: (product: any) => Promise<void>;
  public removeProduct!: (product: any) => Promise<void>;
  public hasProduct!: (product: any) => Promise<boolean>;
}

export default function defineWishlistModel(sequelize: Sequelize): typeof Wishlist {
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
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
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
    }
  );

  return Wishlist;
}