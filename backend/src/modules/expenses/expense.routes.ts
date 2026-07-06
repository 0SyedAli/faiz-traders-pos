import { Router } from "express";
import { z } from "zod";
import { Expense } from "../../models/Expense";
import { ExpenseCategory } from "../../models/ExpenseCategory";
import { requireAdmin } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";

export const expenseRoutes = Router();

expenseRoutes.use(requireAdmin);

const categorySchema = z.object({
  name: z.string().min(1),
  status: z.enum(["active", "inactive"]).optional()
});

const expenseSchema = z.object({
  categoryId: z.string(),
  title: z.string().min(1),
  amount: z.number().min(0),
  paymentMethod: z.enum(["cash", "bank", "easypaisa", "jazzcash", "cheque", "other"]).optional(),
  expenseDate: z.string().optional(),
  note: z.string().optional()
});

expenseRoutes.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const categories = await ExpenseCategory.find().sort({ createdAt: -1 });
    sendResponse(res, 200, "Expense category list.", categories);
  })
);

expenseRoutes.post(
  "/categories",
  asyncHandler(async (req, res) => {
    const body = categorySchema.parse(req.body);
    const category = await ExpenseCategory.create(body);
    sendResponse(res, 201, "Expense category created.", category);
  })
);

expenseRoutes.get(
  "/",
  asyncHandler(async (_req, res) => {
    const expenses = await Expense.find()
      .populate("categoryId", "name")
      .sort({ expenseDate: -1, createdAt: -1 })
      .limit(200);

    sendResponse(res, 200, "Expense list.", expenses);
  })
);

expenseRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = expenseSchema.parse(req.body);
    const expense = await Expense.create({
      ...body,
      expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date()
    });

    sendResponse(res, 201, "Expense created.", expense);
  })
);
