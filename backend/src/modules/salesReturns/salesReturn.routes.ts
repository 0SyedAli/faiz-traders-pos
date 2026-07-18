import { Router } from "express";
import { z } from "zod";
import { SalesReturn } from "../../models/SalesReturn";
import { Sale } from "../../models/Sale";
import { Customer } from "../../models/Customer";
import { CustomerLedger } from "../../models/CustomerLedger";
import { WarehouseStock } from "../../models/WarehouseStock";
import { StockMovement } from "../../models/StockMovement";
import { requireAdmin, AuthRequest } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { ApiError } from "../../utils/apiError";

export const salesReturnRoutes = Router();

salesReturnRoutes.use(requireAdmin);

const returnItemSchema = z.object({
  productVariantId: z.string(),
  quantity: z.number().min(0.001),
  condition: z.enum(["resellable", "damaged"]).default("resellable")
});

const createReturnSchema = z.object({
  saleId: z.string(),
  warehouseId: z.string().optional(),
  items: z.array(returnItemSchema).min(1),
  refundMethod: z.enum(["adjust_credit", "cash", "no_refund"]).default("adjust_credit"),
  adjustInKhata: z.boolean().default(true),
  note: z.string().optional()
});

const getNextReturnNo = async () => {
  const count = await SalesReturn.countDocuments();
  return `RET-${String(count + 1).padStart(6, "0")}`;
};

const getOrCreateStock = async (warehouseId: string, productVariantId: string) => {
  const existing = await WarehouseStock.findOne({ warehouseId, productVariantId });
  if (existing) return existing;

  return WarehouseStock.create({ warehouseId, productVariantId, quantity: 0 });
};

const getAlreadyReturnedMap = async (saleId: string) => {
  const returns = await SalesReturn.find({ saleId });
  const map = new Map<string, number>();

  for (const ret of returns) {
    for (const item of ret.items as any[]) {
      const key = String(item.productVariantId);
      map.set(key, (map.get(key) || 0) + Number(item.quantity || 0));
    }
  }

  return map;
};

salesReturnRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const saleId = String(req.query.saleId || "").trim();
    const filter: any = {};
    if (saleId) filter.saleId = saleId;

    const returns = await SalesReturn.find(filter)
      .populate("saleId", "invoiceNo grandTotal")
      .populate("customerId", "name phone customerType currentBalance")
      .populate("warehouseId", "name type")
      .sort({ createdAt: -1 })
      .limit(200);

    sendResponse(res, 200, "Sales return list.", returns);
  })
);

salesReturnRoutes.get(
  "/sale/:saleId",
  asyncHandler(async (req, res) => {
    const sale = await Sale.findById(req.params.saleId)
      .populate("customerId", "name phone customerType currentBalance")
      .populate("warehouseId", "name type");

    if (!sale) throw new ApiError(404, "Sale not found.");

    const returnedMap = await getAlreadyReturnedMap(String(req.params.saleId));

    const returnableItems = (sale.items as any[]).map((item) => {
      const alreadyReturned = returnedMap.get(String(item.productVariantId)) || 0;
      const soldQty = Number(item.quantity || 0);
      const remainingQty = Math.max(0, soldQty - alreadyReturned);

      return {
        productVariantId: item.productVariantId,
        productNameSnapshot: item.productNameSnapshot,
        skuSnapshot: item.skuSnapshot,
        soldQty,
        alreadyReturned,
        remainingQty,
        unitPrice: item.salePrice,
        lineTotal: item.total
      };
    });

    sendResponse(res, 200, "Sale returnable detail.", { sale, returnableItems });
  })
);

salesReturnRoutes.post(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    const body = createReturnSchema.parse(req.body);

    const sale = await Sale.findById(body.saleId);
    if (!sale) throw new ApiError(404, "Sale not found.");

    const customer = await Customer.findById(sale.customerId);
    if (!customer) throw new ApiError(404, "Customer not found.");

    const warehouseId = body.warehouseId || String(sale.warehouseId);
    const returnedMap = await getAlreadyReturnedMap(body.saleId);

    const saleItemMap = new Map<string, any>();
    for (const item of sale.items as any[]) {
      saleItemMap.set(String(item.productVariantId), item);
    }

    const returnItems: any[] = [];
    let totalReturnAmount = 0;

    for (const inputItem of body.items) {
      const saleItem = saleItemMap.get(inputItem.productVariantId);
      if (!saleItem) throw new ApiError(400, "Selected item does not belong to this invoice.");

      const soldQty = Number(saleItem.quantity || 0);
      const alreadyReturned = returnedMap.get(inputItem.productVariantId) || 0;
      const remainingQty = Math.max(0, soldQty - alreadyReturned);

      if (inputItem.quantity > remainingQty) {
        throw new ApiError(400, `Return quantity cannot exceed remaining quantity for ${saleItem.productNameSnapshot}. Remaining: ${remainingQty}`);
      }

      const unitPrice = Number(saleItem.salePrice || 0);
      const total = Number(inputItem.quantity) * unitPrice;
      totalReturnAmount += total;

      returnItems.push({
        productVariantId: saleItem.productVariantId,
        productNameSnapshot: saleItem.productNameSnapshot,
        skuSnapshot: saleItem.skuSnapshot,
        quantity: inputItem.quantity,
        unitPrice,
        total,
        condition: inputItem.condition
      });
    }

    const returnNo = await getNextReturnNo();

    const salesReturn = await SalesReturn.create({
      returnNo,
      saleId: sale._id,
      customerId: customer._id,
      warehouseId,
      items: returnItems,
      totalReturnAmount,
      refundMethod: body.refundMethod,
      adjustInKhata: body.adjustInKhata,
      note: body.note,
      createdBy: req.admin?._id
    });

    for (const item of returnItems) {
      if (item.condition === "resellable") {
        const stock = await getOrCreateStock(warehouseId, String(item.productVariantId));
        const previousStock = Number(stock.quantity || 0);
        const newStock = previousStock + Number(item.quantity);

        stock.quantity = newStock;
        await stock.save();

        await StockMovement.create({
          warehouseId,
          productVariantId: item.productVariantId,
          type: "return",
          quantity: item.quantity,
          previousStock,
          newStock,
          referenceType: "sales_return",
          referenceId: salesReturn._id,
          note: `Return ${returnNo} against ${sale.invoiceNo}`,
          createdBy: req.admin?._id
        });
      } else {
        await StockMovement.create({
          warehouseId,
          productVariantId: item.productVariantId,
          type: "damage",
          quantity: 0,
          previousStock: 0,
          newStock: 0,
          referenceType: "sales_return",
          referenceId: salesReturn._id,
          note: `Damaged return ${returnNo} against ${sale.invoiceNo}`,
          createdBy: req.admin?._id
        });
      }
    }

    const shouldAdjustKhata =
      body.adjustInKhata &&
      body.refundMethod === "adjust_credit" &&
      customer.customerType !== "walkin" &&
      totalReturnAmount > 0;

    if (shouldAdjustKhata) {
      const oldBalance = Number(customer.currentBalance || 0);
      const newBalance = Math.max(0, oldBalance - totalReturnAmount);

      customer.currentBalance = newBalance;
      await customer.save();

      await CustomerLedger.create({
        customerId: customer._id,
        type: "return",
        debit: 0,
        credit: totalReturnAmount,
        balanceAfter: newBalance,
        referenceType: "sales_return",
        referenceId: salesReturn._id,
        note: `Return ${returnNo} against ${sale.invoiceNo}`
      });
    }

    sendResponse(res, 201, "Sales return created.", salesReturn);
  })
);

salesReturnRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const salesReturn = await SalesReturn.findById(req.params.id)
      .populate("saleId", "invoiceNo grandTotal")
      .populate("customerId", "name phone customerType currentBalance")
      .populate("warehouseId", "name type");

    if (!salesReturn) throw new ApiError(404, "Sales return not found.");

    sendResponse(res, 200, "Sales return detail.", salesReturn);
  })
);
