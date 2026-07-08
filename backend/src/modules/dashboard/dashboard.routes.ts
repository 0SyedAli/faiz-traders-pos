import { Router } from "express";
import { requireAdmin } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { WarehouseStock } from "../../models/WarehouseStock";
import { Customer } from "../../models/Customer";
import { Supplier } from "../../models/Supplier";
import { Expense } from "../../models/Expense";
import { Sale } from "../../models/Sale";
import { Purchase } from "../../models/Purchase";
import { StockMovement } from "../../models/StockMovement";

export const dashboardRoutes = Router();

dashboardRoutes.use(requireAdmin);

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = (date = new Date()) => {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfYear = (date = new Date()) => {
  const d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

dashboardRoutes.get(
  "/",
  asyncHandler(async (_req, res) => {
    const today = startOfDay();
    const month = startOfMonth();
    const year = startOfYear();

    const [todaySalesAgg, monthlySalesAgg, yearlySalesAgg, todayExpensesAgg, monthlyExpensesAgg] =
      await Promise.all([
        Sale.aggregate([
          { $match: { createdAt: { $gte: today } } },
          {
            $project: {
              grandTotal: 1,
              paidAmount: 1,
              dueAmount: 1,
              itemProfit: { $sum: "$items.profit" }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$grandTotal" },
              paid: { $sum: "$paidAmount" },
              due: { $sum: "$dueAmount" },
              profit: { $sum: "$itemProfit" },
              count: { $sum: 1 }
            }
          }
        ]),
        Sale.aggregate([
          { $match: { createdAt: { $gte: month } } },
          {
            $project: {
              grandTotal: 1,
              paidAmount: 1,
              dueAmount: 1,
              itemProfit: { $sum: "$items.profit" }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$grandTotal" },
              paid: { $sum: "$paidAmount" },
              due: { $sum: "$dueAmount" },
              profit: { $sum: "$itemProfit" },
              count: { $sum: 1 }
            }
          }
        ]),
        Sale.aggregate([
          { $match: { createdAt: { $gte: year } } },
          {
            $group: {
              _id: null,
              total: { $sum: "$grandTotal" },
              count: { $sum: 1 }
            }
          }
        ]),
        Expense.aggregate([
          { $match: { expenseDate: { $gte: today } } },
          { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
        ]),
        Expense.aggregate([
          { $match: { expenseDate: { $gte: month } } },
          { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
        ])
      ]);

    const [
      customerCreditAgg,
      supplierPayableAgg,
      stocks,
      recentSales,
      recentPurchases,
      recentMovements,
      customerCount,
      supplierCount,
      productStockCount
    ] = await Promise.all([
      Customer.aggregate([{ $group: { _id: null, total: { $sum: "$currentBalance" } } }]),
      Supplier.aggregate([{ $group: { _id: null, total: { $sum: "$currentBalance" } } }]),
      WarehouseStock.find()
        .populate("warehouseId", "name type")
        .populate({
          path: "productVariantId",
          select: "name sku lowStockAlertQty purchasePrice retailPrice saleUnit",
          populate: [
            { path: "brandId", select: "name" },
            { path: "sizeId", select: "name" }
          ]
        })
        .limit(1000),
      Sale.find().sort({ createdAt: -1 }).limit(8).populate("customerId", "name customerType").populate("warehouseId", "name type"),
      Purchase.find().sort({ createdAt: -1 }).limit(6).populate("supplierId", "name").populate("warehouseId", "name type"),
      StockMovement.find().sort({ createdAt: -1 }).limit(8).populate("warehouseId", "name type").populate("productVariantId", "name sku"),
      Customer.countDocuments({ customerType: { $ne: "walkin" } }),
      Supplier.countDocuments(),
      WarehouseStock.countDocuments()
    ]);

    const lowStock = stocks.filter((s: any) => {
      const variant = s.productVariantId;
      return variant && s.quantity > 0 && s.quantity <= variant.lowStockAlertQty;
    });

    const outOfStock = stocks.filter((s: any) => s.quantity <= 0);

    let inventoryPurchaseValue = 0;
    let inventoryRetailValue = 0;

    for (const s of stocks as any[]) {
      const variant = s.productVariantId;
      inventoryPurchaseValue += Number(s.quantity || 0) * Number(variant?.purchasePrice || 0);
      inventoryRetailValue += Number(s.quantity || 0) * Number(variant?.retailPrice || 0);
    }

    const todaySales = todaySalesAgg[0] || {};
    const monthlySales = monthlySalesAgg[0] || {};
    const yearlySales = yearlySalesAgg[0] || {};
    const todayExpenses = todayExpensesAgg[0] || {};
    const monthlyExpenses = monthlyExpensesAgg[0] || {};

    sendResponse(res, 200, "Dashboard stats.", {
      todaySales: todaySales.total || 0,
      todayProfit: todaySales.profit || 0,
      todayPaid: todaySales.paid || 0,
      todayDue: todaySales.due || 0,
      todayInvoices: todaySales.count || 0,

      monthlySales: monthlySales.total || 0,
      monthlyProfit: monthlySales.profit || 0,
      monthlyDue: monthlySales.due || 0,
      monthlyInvoices: monthlySales.count || 0,

      yearlySales: yearlySales.total || 0,
      yearlyInvoices: yearlySales.count || 0,

      todayExpenses: todayExpenses.total || 0,
      monthlyExpenses: monthlyExpenses.total || 0,

      netTodayProfit: Number(todaySales.profit || 0) - Number(todayExpenses.total || 0),
      netMonthlyProfit: Number(monthlySales.profit || 0) - Number(monthlyExpenses.total || 0),

      customerCredit: customerCreditAgg[0]?.total || 0,
      supplierPayable: supplierPayableAgg[0]?.total || 0,

      customerCount,
      supplierCount,
      stockRows: productStockCount,

      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,

      inventoryPurchaseValue,
      inventoryRetailValue,

      lowStock: lowStock.slice(0, 8),
      outOfStock: outOfStock.slice(0, 8),
      recentSales,
      recentPurchases,
      recentMovements
    });
  })
);
