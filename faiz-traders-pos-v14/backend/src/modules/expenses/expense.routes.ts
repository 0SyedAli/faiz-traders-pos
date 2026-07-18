import { Router } from "express";
import { z } from "zod";
import { Expense } from "../../models/Expense";
import { ExpenseCategory } from "../../models/ExpenseCategory";
import { requireAdmin } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { ApiError } from "../../utils/apiError";

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

expenseRoutes.put(
  "/categories/:id",
  asyncHandler(async (req, res) => {
    const body = categorySchema.partial().parse(req.body);

    const category = await ExpenseCategory.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true
    });

    if (!category) throw new ApiError(404, "Expense category not found.");

    sendResponse(res, 200, "Expense category updated.", category);
  })
);

expenseRoutes.delete(
  "/categories/:id",
  asyncHandler(async (req, res) => {
    const used = await Expense.countDocuments({ categoryId: req.params.id });

    if (used > 0) {
      throw new ApiError(400, "Cannot delete category because expenses are linked with it.");
    }

    const category = await ExpenseCategory.findByIdAndDelete(req.params.id);
    if (!category) throw new ApiError(404, "Expense category not found.");

    sendResponse(res, 200, "Expense category deleted.", category);
  })
);

expenseRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    const categoryId = String(req.query.categoryId || "").trim();

    const filter: any = {};

    if (categoryId) filter.categoryId = categoryId;

    if (from || to) {
      filter.expenseDate = {};
      if (from) {
        from.setHours(0, 0, 0, 0);
        filter.expenseDate.$gte = from;
      }
      if (to) {
        to.setHours(23, 59, 59, 999);
        filter.expenseDate.$lte = to;
      }
    }

    const expenses = await Expense.find(filter)
      .populate("categoryId", "name")
      .sort({ expenseDate: -1, createdAt: -1 })
      .limit(500);

    sendResponse(res, 200, "Expense list.", expenses);
  })
);

expenseRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = expenseSchema.parse(req.body);

    const category = await ExpenseCategory.findById(body.categoryId);
    if (!category) throw new ApiError(404, "Expense category not found.");

    const expense = await Expense.create({
      ...body,
      expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date()
    });

    sendResponse(res, 201, "Expense created.", expense);
  })
);

expenseRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id).populate("categoryId", "name");
    if (!expense) throw new ApiError(404, "Expense not found.");

    sendResponse(res, 200, "Expense detail.", expense);
  })
);

expenseRoutes.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = expenseSchema.partial().parse(req.body);

    const update: any = { ...body };
    if (body.expenseDate) update.expenseDate = new Date(body.expenseDate);

    const expense = await Expense.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    });

    if (!expense) throw new ApiError(404, "Expense not found.");

    sendResponse(res, 200, "Expense updated.", expense);
  })
);

expenseRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) throw new ApiError(404, "Expense not found.");

    sendResponse(res, 200, "Expense deleted.", expense);
  })
);
