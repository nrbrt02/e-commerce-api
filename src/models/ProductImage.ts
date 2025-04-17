import { Model, DataTypes, Optional, Sequelize, Op } from 'sequelize';

// ProductImage attributes interface
export interface ProductImageAttributes {
  id: number;
  productId: number;
  url: string;
  alt?: string;
  order: number;
  isDefault: boolean;
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for optional attributes during creation
interface ProductImageCreationAttributes extends Optional<ProductImageAttributes, 
  'id' | 'alt' | 'order' | 'isDefault' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// ProductImage model class
export class ProductImage extends Model<ProductImageAttributes, ProductImageCreationAttributes> implements ProductImageAttributes {
  public id!: number;
  public productId!: number;
  public url!: string;
  public alt?: string;
  public order!: number;
  public isDefault!: boolean;
  public metadata?: object;
  public createdAt!: Date;
  public updatedAt!: Date;
}

export default function defineProductImageModel(sequelize: Sequelize): typeof ProductImage {
  // Initialize ProductImage model
  ProductImage.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
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
      url: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      alt: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      isDefault: {
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
      modelName: 'ProductImage',
      tableName: 'product_images',
      hooks: {
        // If this is the first image for the product, make it default
        afterCreate: async (image: ProductImage) => {
          const count = await ProductImage.count({
            where: { productId: image.productId }
          });
          
          if (count === 1) {
            await image.update({ isDefault: true });
          } else if (image.isDefault) {
            // If this image is default, ensure no other image is default
            await ProductImage.update(
              { isDefault: false },
              { 
                where: {
                  productId: image.productId,
                  id: { [Op.ne]: image.id }
                }
              }
            );
          }
        },
        beforeUpdate: async (image: ProductImage) => {
          // If this image is set as default, update other images
          if (image.changed('isDefault') && image.isDefault) {
            await ProductImage.update(
              { isDefault: false },
              { 
                where: {
                  productId: image.productId,
                  id: { [Op.ne]: image.id }
                }
              }
            );
          }
        }
      }
    }
  );

  return ProductImage;
}