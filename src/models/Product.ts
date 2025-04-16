// src/models/Product.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';

// Define the interface for Product attributes
interface ProductAttributes {
  id: number;
  name: string;
  description: string;
  shortDescription: string;
  sku: string;
  barcode: string;
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  isPublished: boolean;
  isFeatured: boolean;
  isDigital: boolean;
  quantity: number;
  lowStockThreshold: number | null;
  weight: number | null;
  dimensions: object | null;
  metadata: object | null;
  tags: string[] | null;
  images: string[] | null;
  supplierId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the interface for creating a Product (optional fields)
export interface ProductCreationAttributes extends Optional<ProductAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// Define the Product model class with static associate method
class Product extends Model<ProductAttributes, ProductCreationAttributes> implements ProductAttributes {
  public id!: number;
  public name!: string;
  public description!: string;
  public shortDescription!: string;
  public sku!: string;
  public barcode!: string;
  public price!: number;
  public compareAtPrice!: number | null;
  public costPrice!: number | null;
  public isPublished!: boolean;
  public isFeatured!: boolean;
  public isDigital!: boolean;
  public quantity!: number;
  public lowStockThreshold!: number | null;
  public weight!: number | null;
  public dimensions!: object | null;
  public metadata!: object | null;
  public tags!: string[] | null;
  public images!: string[] | null;
  public supplierId!: number;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // For TypeScript - will be initialized by associations
  public getCategories!: () => Promise<any[]>;
  public setCategories!: (categories: any[]) => Promise<void>;
  public addCategory!: (category: any) => Promise<void>;
  public removeCategory!: (category: any) => Promise<void>;
  public hasCategory!: (category: any) => Promise<boolean>;
  
  // Declare static methods
  static associate: (models: any) => void;
}

// Initialize Product model
Product.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    shortDescription: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    barcode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    compareAtPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    costPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isDigital: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lowStockThreshold: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    weight: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    dimensions: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    modelName: 'Product',
    tableName: 'products',
  }
);

// Define the static associate method
Product.associate = (models) => {
  // Define association with User (supplier)
  Product.belongsTo(models.User, {
    as: 'supplier',
    foreignKey: 'supplierId',
  });
  
  // Define association with Category
  Product.belongsToMany(models.Category, {
    through: 'ProductCategory',
    as: 'categories',
  });
};

export default Product;