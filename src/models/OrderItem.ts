import { Model, DataTypes, Optional, Sequelize } from 'sequelize';

// OrderItem attributes interface
export interface OrderItemAttributes {
  id: number;
  orderId: number;
  productId: number;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for optional attributes during creation
interface OrderItemCreationAttributes extends Optional<OrderItemAttributes, 
  'id' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// OrderItem model class
export class OrderItem extends Model<OrderItemAttributes, OrderItemCreationAttributes> implements OrderItemAttributes {
  public id!: number;
  public orderId!: number;
  public productId!: number;
  public sku!: string;
  public name!: string;
  public quantity!: number;
  public unitPrice!: number;
  public subtotal!: number;
  public discount!: number;
  public tax!: number;
  public total!: number;
  public metadata?: object;
  public createdAt!: Date;
  public updatedAt!: Date;
}

export default function defineOrderItemModel(sequelize: Sequelize): typeof OrderItem {
  // Initialize OrderItem model
  OrderItem.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'orders',
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
      },
      sku: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      discount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      tax: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
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
      modelName: 'OrderItem',
      tableName: 'order_items',
      hooks: {
        // Calculate subtotal and total automatically
        beforeValidate: (item: OrderItem) => {
          item.subtotal = item.quantity * item.unitPrice;
          item.total = item.subtotal - item.discount + item.tax;
        },
        // Update order totals after item changes
        afterCreate: async (item: OrderItem) => {
          // This will be implemented in the index.ts file to avoid circular dependencies
        },
        afterUpdate: async (item: OrderItem) => {
          // This will be implemented in the index.ts file to avoid circular dependencies
        },
        afterDestroy: async (item: OrderItem) => {
          // This will be implemented in the index.ts file to avoid circular dependencies
        }
      }
    }
  );

  return OrderItem;
}