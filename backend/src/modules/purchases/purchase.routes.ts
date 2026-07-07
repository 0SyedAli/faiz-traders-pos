import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Purchase } from "../../models/Purchase";
import { ProductVariant } from "../../models/ProductVariant";
import { WarehouseStock } from "../../models/WarehouseStock";
import { StockMovement } from "../../models/StockMovement";
import { Supplier } from "../../models/Supplier";
import { SupplierLedger } from "../../models/SupplierLedger";
import { requireAdmin, AuthRequest } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { ApiError } from "../../utils/apiError";

export const purchaseRoutes = Router();

purchaseRoutes.use(requireAdmin);

const purchaseSchema = z.object({
  supplierId: z.string(),
  warehouseId: z.string(),
  items: z
    .array(
      z.object({
        productVariantId: z.string(),
        quantity: z.number().min(0.001),
        purchasePrice: z.number().min(0)
      })
    )
    .min(1),
  discountAmount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional(),
  paymentMethod: z.enum(["cash", "bank", "easypaisa", "jazzcash", "cheque", "credit", "other"]).default("cash"),
  note: z.string().optional()
});

const getNextPurchaseNo = async () => {
  const count = await Purchase.countDocuments();
  return `PUR-${String(count + 1).padStart(6, "0")}`;
};

const getOrCreateStock = async (warehouseId: string, productVariantId: string) => {
  const existing = await WarehouseStock.findOne({ warehouseId, productVariantId });
  if (existing) return existing;

  return WarehouseStock.create({
    warehouseId,
    productVariantId,
    quantity: 0
  });
};

const calculatePaymentStatus = (grandTotal: number, paidAmount: number) => {
  if (paidAmount <= 0) return "unpaid";
  if (paidAmount >= grandTotal) return "paid";
  return "partial";
};

purchaseRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const supplierId = String(req.query.supplierId || "").trim();
    const filter: any = {};
    if (supplierId) filter.supplierId = supplierId;

    const purchases = await Purchase.find(filter)
      .populate("supplierId", "name phone currentBalance")
      .populate("warehouseId", "name type")
      .sort({ createdAt: -1 })
      .limit(200);

    sendResponse(res, 200, "Purchase list.", purchases);
  })
);

purchaseRoutes.post(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    const body = purchaseSchema.parse(req.body);

    const supplier = await Supplier.findById(body.supplierId);
    if (!supplier) throw new ApiError(404, "Supplier not found.");

    const purchaseObjectId = new mongoose.Types.ObjectId();
    const purchaseNo = await getNextPurchaseNo();

    const purchaseItems: any[] = [];
    let subtotal = 0;

    for (const item of body.items) {
      const variant = await ProductVariant.findById(item.productVariantId);
      if (!variant) throw new ApiError(404, "Product variant not found.");

      const total = Number(item.quantity) * Number(item.purchasePrice);
      subtotal += total;

      purchaseItems.push({
        productVariantId: variant._id,
        productNameSnapshot: variant.name,
        skuSnapshot: variant.sku,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        total
      });
    }

    const discountAmount = Number(body.discountAmount || 0);
    const grandTotal = Math.max(0, subtotal - discountAmount);
    const paidAmount = Math.min(Number(body.paidAmount || 0), grandTotal);
    const dueAmount = Math.max(0, grandTotal - paidAmount);
    const paymentStatus = calculatePaymentStatus(grandTotal, paidAmount);

    const purchase = await Purchase.create({
      _id: purchaseObjectId,
      purchaseNo,
      supplierId: supplier._id,
      warehouseId: body.warehouseId,
      items: purchaseItems,
      subtotal,
      discountAmount,
      grandTotal,
      paidAmount,
      dueAmount,
      paymentMethod: body.paymentMethod,
      paymentStatus,
      note: body.note,
      createdBy: req.admin?._id
    });

    for (const item of purchaseItems) {
      const stock = await getOrCreateStock(body.warehouseId, String(item.productVariantId));
      const previousStock = Number(stock.quantity || 0);
      const newStock = previousStock + Number(item.quantity);

      stock.quantity = newStock;
      await stock.save();

      await StockMovement.create({
        warehouseId: body.warehouseId,
        productVariantId: item.productVariantId,
        type: "purchase",
        quantity: item.quantity,
        previousStock,
        newStock,
        referenceType: "purchase",
        referenceId: purchase._id,
        note: `Purchase ${purchaseNo}`,
        createdBy: req.admin?._id
      });

      await ProductVariant.findByIdAndUpdate(item.productVariantId, {
        purchasePrice: item.purchasePrice
      });
    }

    const previousSupplierBalance = Number(supplier.currentBalance || 0);
    const afterPurchaseBalance = previousSupplierBalance + grandTotal;
    const finalBalance = afterPurchaseBalance - paidAmount;

    await SupplierLedger.create({
      supplierId: supplier._id,
      type: "purchase",
      debit: 0,
      credit: grandTotal,
      balanceAfter: afterPurchaseBalance,
      referenceType: "purchase",
      referenceId: purchase._id,
      note: `Purchase ${purchaseNo}`
    });

    if (paidAmount > 0) {
      await SupplierLedger.create({
        supplierId: supplier._id,
        type: "payment",
        debit: paidAmount,
        credit: 0,
        balanceAfter: finalBalance,
        referenceType: "purchase_payment",
        referenceId: purchase._id,
        note: `Payment against ${purchaseNo} by ${body.paymentMethod}`
      });
    }

    supplier.currentBalance = finalBalance;
    await supplier.save();

    sendResponse(res, 201, "Purchase created and stock updated.", purchase);
  })
);

purchaseRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const purchase = await Purchase.findById(req.params.id)
      .populate("supplierId", "name phone address currentBalance")
      .populate("warehouseId", "name type");

    if (!purchase) throw new ApiError(404, "Purchase not found.");

    sendResponse(res, 200, "Purchase detail.", purchase);
  })
);
