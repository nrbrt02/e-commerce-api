import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';
import Order from './Order';
import Product from './Product';

// OrderItem attributes interface
export interface OrderItemAttributes {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for optional attributes during creation
interface OrderItemCreationAttributes extends Optional<OrderItemAttributes, 
  'id' | 'taxAmount' | 'discountAmount' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// OrderItem model class
class OrderItem extends Model<OrderItemAttributes, OrderItemCreationAttributes> implements OrderItemAttributes {
  public id!: number;
  public orderId!: number;
  public productId!: number;
  public productName!: string;
  public productSku!: string;
  public quantity!: number;
  public unitPrice!: number;
  public subtotal!: number;
  public taxAmount!: number;
  public discountAmount!: number;
  public totalAmount!: number;
  public metadata?: object;
  public createdAt!: Date;
  public updatedAt!: Date;
}

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
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id',
      },
    },
    productName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    productSku: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    taxAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    discountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
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
      // Calculate totals
      beforeValidate: (orderItem: OrderItem) => {
        orderItem.subtotal = parseFloat(orderItem.unitPrice.toString()) * orderItem.quantity;
        orderItem.totalAmount = 
          parseFloat(orderItem.subtotal.toString()) + 
          parseFloat(orderItem.taxAmount.toString()) - 
          parseFloat(orderItem.discountAmount.toString());
      },
    },
  }
);

// Define associations
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });

OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(OrderItem, { foreignKey: 'productId', as: 'orderItems' });

export default OrderItem;