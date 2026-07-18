import { Router } from "express";
import { z } from "zod";
import { Supplier } from "../../models/Supplier";
import { SupplierLedger } from "../../models/SupplierLedger";
import { Purchase } from "../../models/Purchase";
import { requireAdmin } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { ApiError } from "../../utils/apiError";

export const supplierRoutes = Router();

supplierRoutes.use(requireAdmin);

const supplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  openingBalance: z.number().min(0).optional(),
  status: z.enum(["active", "inactive"]).optional()
});

const supplierPaymentSchema = z.object({
  amount: z.number().min(1),
  paymentMethod: z.enum(["cash", "bank", "easypaisa", "jazzcash", "cheque", "other"]).default("cash"),
  note: z.string().optional()
});

supplierRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();

    const filter: any = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } }
      ];
    }

    const suppliers = await Supplier.find(filter).sort({ createdAt: -1 });
    sendResponse(res, 200, "Supplier list.", suppliers);
  })
);

supplierRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = supplierSchema.parse(req.body);

    const openingBalance = Number(body.openingBalance || 0);

    const supplier = await Supplier.create({
      ...body,
      openingBalance,
      currentBalance: openingBalance
    });

    if (openingBalance > 0) {
      await SupplierLedger.create({
        supplierId: supplier._id,
        type: "opening_balance",
        debit: 0,
        credit: openingBalance,
        balanceAfter: openingBalance,
        referenceType: "opening_balance",
        note: "Opening payable balance"
      });
    }

    sendResponse(res, 201, "Supplier created.", supplier);
  })
);

supplierRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) throw new ApiError(404, "Supplier not found.");

    sendResponse(res, 200, "Supplier detail.", supplier);
  })
);

supplierRoutes.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = supplierSchema.partial().parse(req.body);

    delete (body as any).openingBalance;

    const supplier = await Supplier.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true
    });

    if (!supplier) throw new ApiError(404, "Supplier not found.");

    sendResponse(res, 200, "Supplier updated.", supplier);
  })
);

supplierRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) throw new ApiError(404, "Supplier not found.");

    if (supplier.currentBalance > 0) {
      throw new ApiError(400, "Cannot delete supplier with payable balance.");
    }

    const purchaseCount = await Purchase.countDocuments({ supplierId: supplier._id });
    if (purchaseCount > 0) {
      throw new ApiError(400, "Cannot delete supplier with purchase history. Set inactive instead.");
    }

    await SupplierLedger.deleteMany({ supplierId: supplier._id });
    await Supplier.findByIdAndDelete(supplier._id);

    sendResponse(res, 200, "Supplier deleted.", supplier);
  })
);

supplierRoutes.get(
  "/:id/ledger",
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) throw new ApiError(404, "Supplier not found.");

    const ledger = await SupplierLedger.find({ supplierId: supplier._id }).sort({ createdAt: -1 });

    sendResponse(res, 200, "Supplier ledger.", { supplier, ledger });
  })
);

supplierRoutes.post(
  "/:id/pay",
  asyncHandler(async (req, res) => {
    const body = supplierPaymentSchema.parse(req.body);

    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) throw new ApiError(404, "Supplier not found.");

    const amount = Number(body.amount);
    const newBalance = Math.max(0, Number(supplier.currentBalance || 0) - amount);

    supplier.currentBalance = newBalance;
    await supplier.save();

    const ledger = await SupplierLedger.create({
      supplierId: supplier._id,
      type: "payment",
      debit: amount,
      credit: 0,
      balanceAfter: newBalance,
      referenceType: "supplier_payment",
      note: body.note || `Supplier payment by ${body.paymentMethod}`
    });

    sendResponse(res, 200, "Supplier payment saved.", { supplier, ledger });
  })
);
