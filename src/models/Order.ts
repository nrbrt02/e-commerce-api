import { Model, DataTypes, Optional, Sequelize } from 'sequelize';

// Define order status enum
export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  COMPLETED = 'completed'
}

// Define payment status enum
export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

// Order attributes interface
export interface OrderAttributes {
  id: number;
  customerId: number;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  totalItems: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  paymentDetails?: object;
  shippingMethod?: string;
  shippingAddress?: object;
  billingAddress?: object;
  notes?: string;
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for optional attributes during creation
interface OrderCreationAttributes extends Optional<OrderAttributes, 
  'id' | 'paymentMethod' | 'paymentDetails' | 'shippingMethod' | 'shippingAddress' |
  'billingAddress' | 'notes' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// Order model class
export class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  public id!: number;
  public customerId!: number;
  public orderNumber!: string;
  public status!: OrderStatus;
  public totalAmount!: number;
  public totalItems!: number;
  public paymentStatus!: PaymentStatus;
  public paymentMethod?: string;
  public paymentDetails?: object;
  public shippingMethod?: string;
  public shippingAddress?: object;
  public billingAddress?: object;
  public notes?: string;
  public metadata?: object;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Association methods
  public getItems!: () => Promise<any[]>;
}

export default function defineOrderModel(sequelize: Sequelize): typeof Order {
  // Initialize Order model
  Order.init(
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
      },
      orderNumber: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(OrderStatus)),
        allowNull: false,
        defaultValue: OrderStatus.PENDING,
      },
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      totalItems: {
        type: DataTypes.INTEGER,
        allowNull: false,
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
      shippingMethod: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      shippingAddress: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      billingAddress: {
        type: DataTypes.JSONB,
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
        beforeCreate: (order: Order) => {
          // Generate order number if not provided
          if (!order.orderNumber) {
            const prefix = 'ORD';
            const timestamp = Date.now().toString();
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            order.orderNumber = `${prefix}-${timestamp.substring(timestamp.length - 6)}-${random}`;
          }
        }
      }
    }
  );

  return Order;
}