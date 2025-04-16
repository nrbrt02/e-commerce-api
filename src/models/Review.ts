import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';
import Product from './Product';
import Customer from './Customer';

// Review attributes interface
export interface ReviewAttributes {
  id: number;
  productId: number;
  customerId: number;
  orderId?: number;
  rating: number;
  title?: string;
  comment?: string;
  isVerifiedPurchase: boolean;
  isApproved: boolean;
  helpfulVotes: number;
  media?: string[];
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for optional attributes during creation
interface ReviewCreationAttributes extends Optional<ReviewAttributes, 
  'id' | 'orderId' | 'title' | 'comment' | 'isVerifiedPurchase' | 'isApproved' | 'helpfulVotes' | 'media' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// Review model class
class Review extends Model<ReviewAttributes, ReviewCreationAttributes> implements ReviewAttributes {
  public id!: number;
  public productId!: number;
  public customerId!: number;
  public orderId?: number;
  public rating!: number;
  public title?: string;
  public comment?: string;
  public isVerifiedPurchase!: boolean;
  public isApproved!: boolean;
  public helpfulVotes!: number;
  public media?: string[];
  public metadata?: object;
  public createdAt!: Date;
  public updatedAt!: Date;
}

// Initialize Review model
Review.init(
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
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'customers',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'orders',
        key: 'id',
      },
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isVerifiedPurchase: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isApproved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    helpfulVotes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    media: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
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
    modelName: 'Review',
    tableName: 'reviews',
    indexes: [
      {
        name: 'reviews_product_customer_idx',
        unique: true,
        fields: ['productId', 'customerId'],
      },
    ],
    hooks: {
      afterCreate: async (review: Review) => {
        // Update product rating
        await updateProductRating(review.productId);
      },
      afterUpdate: async (review: Review) => {
        // Update product rating if rating changed
        if (review.changed('rating') || review.changed('isApproved')) {
          await updateProductRating(review.productId);
        }
      },
      afterDestroy: async (review: Review) => {
        // Update product rating
        await updateProductRating(review.productId);
      },
    },
  }
);

// Helper function to update product rating
async function updateProductRating(productId: number): Promise<void> {
  // Get all approved reviews for this product
  const reviews = await Review.findAll({
    where: {
      productId,
      isApproved: true,
    },
    attributes: ['rating'],
  });

  // Calculate average rating
  let avgRating = 0;
  if (reviews.length > 0) {
    const sum = reviews.reduce((total, review) => total + review.rating, 0);
    avgRating = sum / reviews.length;
  }

  // Update product with new rating
  await Product.update(
    {
      metadata: {
        ...(await Product.findByPk(productId))?.metadata,
        rating: {
          average: avgRating,
          count: reviews.length,
        },
      },
    },
    {
      where: { id: productId },
    }
  );
}

// Define associations
Review.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(Review, { foreignKey: 'productId', as: 'reviews' });

Review.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Customer.hasMany(Review, { foreignKey: 'customerId', as: 'reviews' });

export default Review;