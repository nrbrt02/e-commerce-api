import { Request, Response } from "express";
import db, { sequelize } from "../models";
import { Op, fn, col, literal, QueryTypes } from "sequelize";
import moment from "moment";

type StatusCount = {
  status: string;
  count: number;
};
class StatsController {
  /**
   * Get overall business statistics
   */
  getBusinessStats = async (req: Request, res: Response) => {
    try {
      // Run all stats queries in parallel
      const [
        totalRevenue,
        totalOrders,
        totalCustomers,
        totalProducts,
        activeSuppliers,
        recentOrders,
        salesTrend,
        popularProducts,
        customerGrowth,
        orderStatusStats,
        revenueByCategory,
      ] = await Promise.all([
        this._getTotalRevenue(),
        this._getTotalOrders(),
        this._getTotalCustomers(),
        this._getTotalProducts(),
        this._getActiveSuppliers(),
        this._getRecentOrders(5),
        this._getSalesTrend(30),
        this._getPopularProducts(5),
        this._getCustomerGrowth(12),
        this._getOrderStatusStats(),
        this._getRevenueByCategory(),
      ]);

      res.json({
        success: true,
        data: {
          overview: {
            totalRevenue,
            totalOrders,
            totalCustomers,
            totalProducts,
            activeSuppliers,
          },
          recentOrders,
          salesTrend,
          popularProducts,
          customerGrowth,
          orderStatusStats,
          revenueByCategory,
        },
      });
    } catch (error) {
      console.error("Error fetching business stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch business statistics",
      });
    }
  };

  /**
   * Get total revenue (sum of all completed orders)
   */
  private async _getTotalRevenue(): Promise<number> {
    const result = await db.Order.sum("totalAmount", {
      where: {
        status: "completed",
        paymentStatus: "paid",
      },
    });
    return result || 0;
  }

  /**
   * Get total number of orders
   */
  private async _getTotalOrders(): Promise<number> {
    return db.Order.count();
  }

  /**
   * Get total number of customers
   */
  private async _getTotalCustomers(): Promise<number> {
    return db.Customer.count();
  }

  /**
   * Get total number of products
   */
  private async _getTotalProducts(): Promise<number> {
    return db.Product.count();
  }

  /**
   * Get number of active suppliers
   */
  private async _getActiveSuppliers(): Promise<number> {
    return db.Supplier.count({
      where: {
        isActive: true,
      },
    });
  }

  /**
   * Get recent orders
   */
  private async _getRecentOrders(limit: number = 5): Promise<any[]> {
    return db.Order.findAll({
      where: {
        status: {
          [Op.notIn]: ["cancelled", "refunded"],
        },
      },
      include: [
        {
          model: db.Customer,
          as: "customer",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],

      order: [["createdAt", "DESC"]],
      limit,
    });
  }

  /**
   * Get sales trend for the last N days
   */
  private async _getSalesTrend(days: number = 30): Promise<any[]> {
    const fromDate = moment().subtract(days, "days").startOf("day").toDate();

    const results = await sequelize.query(
      `
    SELECT 
      DATE("createdAt") AS date,
      COUNT(*) AS "orderCount",
      SUM("totalAmount") AS "totalRevenue"
    FROM "orders"
    WHERE "createdAt" >= :fromDate
      AND "status" = 'completed'
      AND "paymentStatus" = 'paid'
    GROUP BY DATE("createdAt")
    ORDER BY DATE("createdAt") ASC
    `,
      {
        replacements: { fromDate },
        type: QueryTypes.SELECT,
      }
    );

    // Prepare the full date range with zero values
    const dateMap = new Map<string, any>();
    const currentDate = moment(fromDate);
    const endDate = moment();

    while (currentDate.isSameOrBefore(endDate, "day")) {
      const dateStr = currentDate.format("YYYY-MM-DD");
      dateMap.set(dateStr, {
        date: dateStr,
        orderCount: 0,
        totalRevenue: 0,
      });
      currentDate.add(1, "day");
    }

    // Inject actual result values into the map
    (results as any[]).forEach((row) => {
      const dateStr = moment(row.date).format("YYYY-MM-DD");
      dateMap.set(dateStr, {
        date: dateStr,
        orderCount: Number(row.orderCount),
        totalRevenue: parseFloat(row.totalRevenue),
      });
    });

    return Array.from(dateMap.values());
  }

  /**
   * Get most popular products by order quantity
   */
  private async _getPopularProducts(limit: number = 5): Promise<any[]> {
    return db.OrderItem.findAll({
      attributes: [
        "productId",
        [fn("SUM", col("OrderItem.quantity")), "totalQuantity"],
        [fn("SUM", col("OrderItem.total")), "totalRevenue"],
      ],
      include: [
        {
          model: db.Product,
          as: "product",
          attributes: ["id", "name", "imageUrls"],
          required: true,
        },
      ],
      group: ["OrderItem.productId", "product.id"], // Explicit alias
      order: [[literal(`"totalQuantity"`), "DESC"]],
      limit,
      raw: true,
    });
  }

  /**
   * Get customer growth over months
   */
  private async _getCustomerGrowth(months: number = 12): Promise<any[]> {
    const startDate = moment()
      .subtract(months, "months")
      .startOf("month")
      .toDate();

    return db.Customer.findAll({
      attributes: [
        [fn("DATE_TRUNC", "month", col("createdAt")), "month"],
        [fn("COUNT", col("id")), "count"],
      ],

      where: {
        createdAt: {
          [Op.gte]: startDate,
        },
      },
      group: ["month"],
      order: [["month", "ASC"]],
      raw: true,
    });
  }

  /**
   * Get order status distribution
   */
  private _getOrderStatusStats = async (): Promise<any> => {
    const results = (await db.Order.findAll({
      attributes: ["status", [fn("COUNT", col("id")), "count"]],
      group: ["status"],
      raw: true,
    })) as StatusCount[];

    const total = results.reduce(
      (sum: number, item: StatusCount) => sum + (item.count || 0),
      0
    );

    return {
      total,
      statuses: results.map((item: StatusCount) => ({
        status: item.status,
        count: item.count,
        percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
      })),
    };
  };

  /**
   * Get revenue by product category
   */
  private _getRevenueByCategory = async (): Promise<any[]> => {
    return sequelize.query(
      `
      SELECT 
    c.id,
    c.name,
    c.image,
    SUM(oi."total") AS "totalRevenue",
    COUNT(DISTINCT oi."orderId") AS "orderCount"
  FROM "order_items" oi
  JOIN products p ON oi."productId" = p.id
  JOIN "ProductCategories" pc ON p.id = pc."ProductId"
  JOIN categories c ON pc."CategoryId" = c.id
  JOIN orders o ON oi."orderId" = o.id
  WHERE o."status" = 'completed'
    AND o."paymentStatus" = 'paid'
  GROUP BY c.id
  ORDER BY "totalRevenue" DESC
  LIMIT 10
    `,
      {
        type: QueryTypes.SELECT,
      }
    );
  };

  /**
   * Get supplier statistics
   */
  getSupplierStats = async (req: Request, res: Response) => {
    try {
      // Get top suppliers by product count and revenue
      const topSuppliers = await sequelize.query(
        `
  SELECT 
    s.id,
    s.name,
    s."logoUrl",
    COUNT(p.id) as productCount,
    COALESCE(SUM(oi.total), 0) as totalRevenue
  FROM suppliers s
  LEFT JOIN products p ON s.id = p."supplierId"
  LEFT JOIN order_items oi ON p.id = oi."productId"
  LEFT JOIN orders o ON oi."orderId" = o.id
    AND o.status = 'completed'
    AND o."paymentStatus" = 'paid'
  GROUP BY s.id
  ORDER BY totalRevenue DESC
  LIMIT 10
  `,
        {
          type: QueryTypes.SELECT,
        }
      );

      // Get supplier verification stats
      const verificationStats = await db.Supplier.findAll({
        attributes: [
          "isVerified",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        group: ["isVerified"],
        raw: true,
      });

      res.json({
        success: true,
        data: {
          topSuppliers,
          verificationStats,
        },
      });
    } catch (error) {
      console.error("Error fetching supplier stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch supplier statistics",
      });
    }
  };

  /**
   * Get inventory statistics
   */
  getInventoryStats = async (req: Request, res: Response) => {
    try {
      // Get low stock products
      const lowStockProducts = await db.Product.findAll({
        where: {
          quantity: {
            [Op.lte]: col("lowStockThreshold"),
          },
        },
        order: [["quantity", "ASC"]],
        limit: 10,
      });

      // Get stock status distribution
      const stockStatus = await sequelize.query(
        `
  SELECT 
    CASE 
      WHEN quantity <= 0 THEN 'out_of_stock'
      WHEN quantity <= "lowStockThreshold" OR ("lowStockThreshold" IS NULL AND quantity <= 5) THEN 'low_stock'
      ELSE 'in_stock'
    END as status,
    COUNT(*) as count
  FROM products
  GROUP BY status
  `,
        {
          type: QueryTypes.SELECT,
        }
      );

      res.json({
        success: true,
        data: {
          lowStockProducts,
          stockStatus,
        },
      });
    } catch (error) {
      console.error("Error fetching inventory stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch inventory statistics",
      });
    }
  };
}

export default new StatsController();
