import { Model, DataTypes, Optional, Sequelize } from 'sequelize';

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
export class Review extends Model<ReviewAttributes, ReviewCreationAttributes> implements ReviewAttributes {
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

export default function defineReviewModel(sequelize: Sequelize): typeof Review {
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
          // Update product rating - implementation will be handled in the index.ts
          // We'll implement this in a way that avoids circular dependencies
        },
        afterUpdate: async (review: Review) => {
          // Update product rating - implementation will be handled in the index.ts
        },
        afterDestroy: async (review: Review) => {
          // Update product rating - implementation will be handled in the index.ts
        },
      },
    }
  );

  return Review;
}