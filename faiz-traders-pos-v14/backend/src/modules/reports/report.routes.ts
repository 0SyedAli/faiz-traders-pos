import { Router } from "express";
import { requireAdmin } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { Sale } from "../../models/Sale";
import { Purchase } from "../../models/Purchase";
import { Expense } from "../../models/Expense";
import { Customer } from "../../models/Customer";
import { Supplier } from "../../models/Supplier";
import { WarehouseStock } from "../../models/WarehouseStock";
import { StockMovement } from "../../models/StockMovement";

export const reportRoutes = Router();

reportRoutes.use(requireAdmin);

const parseDateRange = (query: any) => {
  const from = query.from ? new Date(String(query.from)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = query.to ? new Date(String(query.to)) : new Date();

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  return { from, to };
};

const emptyTotals = {
  count: 0,
  total: 0,
  paid: 0,
  due: 0,
  profit: 0
};

reportRoutes.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const { from, to } = parseDateRange(req.query);

    const [salesTotals, purchaseTotals, expenseTotals, customerCredit, supplierPayable, stockRows] =
      await Promise.all([
        Sale.aggregate([
          { $match: { createdAt: { $gte: from, $lte: to } } },
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
              count: { $sum: 1 },
              total: { $sum: "$grandTotal" },
              paid: { $sum: "$paidAmount" },
              due: { $sum: "$dueAmount" },
              profit: { $sum: "$itemProfit" }
            }
          }
        ]),
        Purchase.aggregate([
          { $match: { createdAt: { $gte: from, $lte: to } } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              total: { $sum: "$grandTotal" },
              paid: { $sum: "$paidAmount" },
              due: { $sum: "$dueAmount" }
            }
          }
        ]),
        Expense.aggregate([
          { $match: { expenseDate: { $gte: from, $lte: to } } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              total: { $sum: "$amount" }
            }
          }
        ]),
        Customer.aggregate([{ $group: { _id: null, total: { $sum: "$currentBalance" } } }]),
        Supplier.aggregate([{ $group: { _id: null, total: { $sum: "$currentBalance" } } }]),
        WarehouseStock.find().populate("productVariantId", "purchasePrice retailPrice lowStockAlertQty")
      ]);

    let purchaseValue = 0;
    let retailValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const row of stockRows as any[]) {
      const variant = row.productVariantId;
      const qty = Number(row.quantity || 0);
      purchaseValue += qty * Number(variant?.purchasePrice || 0);
      retailValue += qty * Number(variant?.retailPrice || 0);

      if (qty <= 0) outOfStockCount += 1;
      else if (qty <= Number(variant?.lowStockAlertQty || 0)) lowStockCount += 1;
    }

    const sales = salesTotals[0] || emptyTotals;
    const purchases = purchaseTotals[0] || emptyTotals;
    const expenses = expenseTotals[0] || { count: 0, total: 0 };

    sendResponse(res, 200, "Report summary.", {
      range: { from, to },
      sales,
      purchases,
      expenses,
      netProfit: Number(sales.profit || 0) - Number(expenses.total || 0),
      customerCredit: customerCredit[0]?.total || 0,
      supplierPayable: supplierPayable[0]?.total || 0,
      inventory: {
        purchaseValue,
        retailValue,
        lowStockCount,
        outOfStockCount
      }
    });
  })
);

reportRoutes.get(
  "/expenses-by-category",
  asyncHandler(async (req, res) => {
    const { from, to } = parseDateRange(req.query);

    const rows = await Expense.aggregate([
      { $match: { expenseDate: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: "$categoryId",
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "expensecategories",
          localField: "_id",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          categoryId: "$_id",
          categoryName: { $ifNull: ["$category.name", "Uncategorized"] },
          total: 1,
          count: 1
        }
      },
      { $sort: { total: -1 } }
    ]);

    sendResponse(res, 200, "Expenses by category.", rows);
  })
);

reportRoutes.get(
  "/top-stock",
  asyncHandler(async (_req, res) => {
    const rows = await WarehouseStock.find()
      .populate("warehouseId", "name type")
      .populate({
        path: "productVariantId",
        select: "name sku purchasePrice retailPrice lowStockAlertQty saleUnit",
        populate: [
          { path: "brandId", select: "name" },
          { path: "sizeId", select: "name" }
        ]
      })
      .sort({ quantity: 1 })
      .limit(50);

    sendResponse(res, 200, "Top stock report.", rows);
  })
);

reportRoutes.get(
  "/stock-movements",
  asyncHandler(async (req, res) => {
    const { from, to } = parseDateRange(req.query);

    const rows = await StockMovement.find({ createdAt: { $gte: from, $lte: to } })
      .populate("warehouseId", "name type")
      .populate("productVariantId", "name sku")
      .sort({ createdAt: -1 })
      .limit(300);

    sendResponse(res, 200, "Stock movements report.", rows);
  })
);
