import { Router } from "express";
import { requireAdmin } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { WarehouseStock } from "../../models/WarehouseStock";
import { Customer } from "../../models/Customer";
import { Supplier } from "../../models/Supplier";
import { Expense } from "../../models/Expense";
import { Sale } from "../../models/Sale";

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
        Sale.aggregate([{ $match: { createdAt: { $gte: today } } }, { $group: { _id: null, total: { $sum: "$grandTotal" }, profit: { $sum: { $sum: "$items.profit" } } } }]),
        Sale.aggregate([{ $match: { createdAt: { $gte: month } } }, { $group: { _id: null, total: { $sum: "$grandTotal" } } }]),
        Sale.aggregate([{ $match: { createdAt: { $gte: year } } }, { $group: { _id: null, total: { $sum: "$grandTotal" } } }]),
        Expense.aggregate([{ $match: { expenseDate: { $gte: today } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
        Expense.aggregate([{ $match: { expenseDate: { $gte: month } } }, { $group: { _id: null, total: { $sum: "$amount" } } }])
      ]);

    const [customerCreditAgg, supplierPayableAgg, stocks, recentSales] = await Promise.all([
      Customer.aggregate([{ $group: { _id: null, total: { $sum: "$currentBalance" } } }]),
      Supplier.aggregate([{ $group: { _id: null, total: { $sum: "$currentBalance" } } }]),
      WarehouseStock.find().populate("productVariantId", "name sku lowStockAlertQty").limit(500),
      Sale.find().sort({ createdAt: -1 }).limit(10).populate("customerId", "name customerType")
    ]);

    const lowStock = stocks.filter((s: any) => {
      const v = s.productVariantId;
      return v && s.quantity > 0 && s.quantity <= v.lowStockAlertQty;
    });

    const outOfStock = stocks.filter((s: any) => s.quantity === 0);

    sendResponse(res, 200, "Dashboard stats.", {
      todaySales: todaySalesAgg[0]?.total || 0,
      todayProfit: todaySalesAgg[0]?.profit || 0,
      monthlySales: monthlySalesAgg[0]?.total || 0,
      yearlySales: yearlySalesAgg[0]?.total || 0,
      todayExpenses: todayExpensesAgg[0]?.total || 0,
      monthlyExpenses: monthlyExpensesAgg[0]?.total || 0,
      customerCredit: customerCreditAgg[0]?.total || 0,
      supplierPayable: supplierPayableAgg[0]?.total || 0,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      recentSales
    });
  })
);
