import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';
import Customer from './Customer';
import Address from './Address';
import OrderItem from './OrderItem';

// Order status enum
export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

// Payment status enum
export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// Define OrderItem interface for type safety
// interface OrderItem {
//   id: number;
//   quantity: number;
//   price: number;
//   // Add other fields as needed
// }

// Order attributes interface
export interface OrderAttributes {
  id: number;
  orderNumber: string;
  customerId: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  paymentDetails?: object;
  currency: string;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  shippingAddressId?: number;
  billingAddressId?: number;
  shippingAddressSnapshot?: object;
  billingAddressSnapshot?: object;
  shippingMethod?: string;
  notes?: string;
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for optional attributes during creation
interface OrderCreationAttributes extends Optional<OrderAttributes, 
  'id' | 'paymentMethod' | 'paymentDetails' | 'discountAmount' | 
  'shippingAddressId' | 'billingAddressId' | 'shippingAddressSnapshot' | 'billingAddressSnapshot' |
  'shippingMethod' | 'notes' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// Order model class
class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  public id!: number;
  public orderNumber!: string;
  public customerId!: number;
  public status!: OrderStatus;
  public paymentStatus!: PaymentStatus;
  public paymentMethod?: string;
  public paymentDetails?: object;
  public currency!: string;
  public subtotal!: number;
  public taxAmount!: number;
  public shippingAmount!: number;
  public discountAmount!: number;
  public totalAmount!: number;
  public shippingAddressId?: number;
  public billingAddressId?: number;
  public shippingAddressSnapshot?: object;
  public billingAddressSnapshot?: object;
  public shippingMethod?: string;
  public notes?: string;
  public metadata?: object;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Association methods
  public getItems!: () => Promise<OrderItem[]>;

  // Helper method to check if order is complete
  public isComplete(): boolean {
    return [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED].includes(this.status);
  }

  // Helper method to check if order is paid
  public isPaid(): boolean {
    return this.paymentStatus === PaymentStatus.PAID;
  }

  // Helper method to calculate total items in order
  public async getTotalItems(): Promise<number> {
    const items = await this.getItems();
    return items.reduce((sum: number, item: OrderItem) => sum + item.quantity, 0);
  }
}

// Initialize Order model
Order.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    orderNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'customers',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(OrderStatus)),
      allowNull: false,
      defaultValue: OrderStatus.PENDING,
    },
    paymentStatus: {
      type: DataTypes.ENUM(...Object.values(PaymentStatus)),
      allowNull: false,
      defaultValue: PaymentStatus.PENDING,
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    paymentDetails: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD',
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
    shippingAmount: {
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
    shippingAddressId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'addresses',
        key: 'id',
      },
    },
    billingAddressId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'addresses',
        key: 'id',
      },
    },
    shippingAddressSnapshot: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    billingAddressSnapshot: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    shippingMethod: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
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
    modelName: 'Order',
    tableName: 'orders',
    hooks: {
      // Auto-generate order number if not provided
      beforeValidate: (order: Order) => {
        if (!order.orderNumber) {
          const timestamp = Date.now().toString();
          const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          order.orderNumber = `ORD-${timestamp.substring(timestamp.length - 6)}${randomNum}`;
        }

        // Calculate total amount
        order.totalAmount = 
          parseFloat(order.subtotal.toString()) + 
          parseFloat(order.taxAmount.toString()) + 
          parseFloat(order.shippingAmount.toString()) - 
          parseFloat(order.discountAmount.toString());
      },
      // Create address snapshots before saving
      beforeCreate: async (order: Order) => {
        // Create snapshot of shipping address
        if (order.shippingAddressId && !order.shippingAddressSnapshot) {
          const shippingAddress = await Address.findByPk(order.shippingAddressId);
          if (shippingAddress) {
            order.shippingAddressSnapshot = {
              ...shippingAddress.toJSON(),
              capturedAt: new Date(),
            };
          }
        }
        
        // Create snapshot of billing address
        if (order.billingAddressId && !order.billingAddressSnapshot) {
          const billingAddress = await Address.findByPk(order.billingAddressId);
          if (billingAddress) {
            order.billingAddressSnapshot = {
              ...billingAddress.toJSON(),
              capturedAt: new Date(),
            };
          }
        }
      }
    },
  }
);

// Define associations
Order.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Customer.hasMany(Order, { foreignKey: 'customerId', as: 'orders' });

Order.belongsTo(Address, { foreignKey: 'shippingAddressId', as: 'shippingAddress' });
Order.belongsTo(Address, { foreignKey: 'billingAddressId', as: 'billingAddress' });


Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
Order.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
export default Order;