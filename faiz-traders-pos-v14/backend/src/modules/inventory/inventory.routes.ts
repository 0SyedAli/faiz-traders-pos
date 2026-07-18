import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { WarehouseStock } from "../../models/WarehouseStock";
import { StockMovement } from "../../models/StockMovement";
import { StockTransfer } from "../../models/StockTransfer";
import { ProductVariant } from "../../models/ProductVariant";
import { requireAdmin, AuthRequest } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { ApiError } from "../../utils/apiError";

export const inventoryRoutes = Router();

inventoryRoutes.use(requireAdmin);

const adjustStockSchema = z.object({
  warehouseId: z.string(),
  productVariantId: z.string(),
  newQuantity: z.number().min(0),
  note: z.string().optional()
});

const transferSchema = z.object({
  fromWarehouseId: z.string(),
  toWarehouseId: z.string(),
  items: z
    .array(
      z.object({
        productVariantId: z.string(),
        quantity: z.number().min(0.001)
      })
    )
    .min(1),
  note: z.string().optional()
});

const getNextTransferNo = async () => {
  const count = await StockTransfer.countDocuments();
  return `TRF-${String(count + 1).padStart(6, "0")}`;
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

inventoryRoutes.get(
  "/stocks",
  asyncHandler(async (req, res) => {
    const warehouseId = String(req.query.warehouseId || "").trim();
    const q = String(req.query.q || "").trim();

    const filter: any = {};
    if (warehouseId) filter.warehouseId = warehouseId;

    const stocks = await WarehouseStock.find(filter)
      .populate("warehouseId", "name type")
      .populate({
        path: "productVariantId",
        select:
          "name sku barcode lowStockAlertQty saleUnit baseUnit lengthPerPiece purchasePrice retailPrice plumberPrice",
        populate: [
          { path: "brandId", select: "name" },
          { path: "categoryId", select: "name" },
          { path: "sizeId", select: "name" },
          { path: "unitId", select: "name shortName" }
        ]
      })
      .sort({ updatedAt: -1 });

    const filtered = q
      ? stocks.filter((stock: any) => {
          const variant = stock.productVariantId;
          const text = [
            variant?.name,
            variant?.sku,
            variant?.barcode,
            variant?.brandId?.name,
            variant?.categoryId?.name,
            variant?.sizeId?.name,
            stock?.warehouseId?.name
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return text.includes(q.toLowerCase());
        })
      : stocks;

    sendResponse(res, 200, "Warehouse stock list.", filtered);
  })
);

inventoryRoutes.post(
  "/adjust-stock",
  asyncHandler(async (req: AuthRequest, res) => {
    const body = adjustStockSchema.parse(req.body);

    const variant = await ProductVariant.findById(body.productVariantId);
    if (!variant) throw new ApiError(404, "Product variant not found.");

    const stock = await WarehouseStock.findOneAndUpdate(
      {
        warehouseId: body.warehouseId,
        productVariantId: body.productVariantId
      },
      { $setOnInsert: { quantity: 0 } },
      { upsert: true, new: true }
    );

    const previousStock = stock.quantity;
    const newStock = body.newQuantity;
    const difference = newStock - previousStock;

    stock.quantity = newStock;
    await stock.save();

    const movement = await StockMovement.create({
      warehouseId: body.warehouseId,
      productVariantId: body.productVariantId,
      type: previousStock === 0 && newStock > 0 ? "opening_stock" : "adjustment",
      quantity: difference,
      previousStock,
      newStock,
      referenceType: "manual_adjustment",
      note: body.note || "Manual stock adjustment",
      createdBy: req.admin?._id
    });

    sendResponse(res, 200, "Stock adjusted.", { stock, movement });
  })
);

inventoryRoutes.post(
  "/transfer",
  asyncHandler(async (req: AuthRequest, res) => {
    const body = transferSchema.parse(req.body);

    if (body.fromWarehouseId === body.toWarehouseId) {
      throw new ApiError(400, "From and to warehouse cannot be same.");
    }

    const transferNo = await getNextTransferNo();
    const transferObjectId = new mongoose.Types.ObjectId();

    const transferItems: any[] = [];

    // First validate all stock before changing anything.
    for (const item of body.items) {
      const variant = await ProductVariant.findById(item.productVariantId);
      if (!variant) throw new ApiError(404, "Product variant not found.");

      const fromStock = await getOrCreateStock(body.fromWarehouseId, item.productVariantId);

      if (fromStock.quantity < item.quantity) {
        throw new ApiError(
          400,
          `Not enough stock for ${variant.name}. Available: ${fromStock.quantity}`
        );
      }
    }

    for (const item of body.items) {
      const variant = await ProductVariant.findById(item.productVariantId);
      if (!variant) throw new ApiError(404, "Product variant not found.");

      const fromStock = await getOrCreateStock(body.fromWarehouseId, item.productVariantId);
      const toStock = await getOrCreateStock(body.toWarehouseId, item.productVariantId);

      const fromPrevious = fromStock.quantity;
      const toPrevious = toStock.quantity;

      fromStock.quantity = fromPrevious - item.quantity;
      toStock.quantity = toPrevious + item.quantity;

      await fromStock.save();
      await toStock.save();

      transferItems.push({
        productVariantId: variant._id,
        productNameSnapshot: variant.name,
        skuSnapshot: variant.sku,
        quantity: item.quantity
      });

      await StockMovement.create([
        {
          warehouseId: body.fromWarehouseId,
          productVariantId: item.productVariantId,
          type: "transfer_out",
          quantity: -item.quantity,
          previousStock: fromPrevious,
          newStock: fromStock.quantity,
          referenceType: "stock_transfer",
          referenceId: transferObjectId,
          note: body.note || `Transfer out ${transferNo}`,
          createdBy: req.admin?._id
        },
        {
          warehouseId: body.toWarehouseId,
          productVariantId: item.productVariantId,
          type: "transfer_in",
          quantity: item.quantity,
          previousStock: toPrevious,
          newStock: toStock.quantity,
          referenceType: "stock_transfer",
          referenceId: transferObjectId,
          note: body.note || `Transfer in ${transferNo}`,
          createdBy: req.admin?._id
        }
      ]);
    }

    const transfer = await StockTransfer.create({
      _id: transferObjectId,
      transferNo,
      fromWarehouseId: body.fromWarehouseId,
      toWarehouseId: body.toWarehouseId,
      items: transferItems,
      note: body.note,
      status: "completed",
      createdBy: req.admin?._id
    });

    sendResponse(res, 201, "Stock transferred.", transfer);
  })
);

inventoryRoutes.get(
  "/transfers",
  asyncHandler(async (_req, res) => {
    const transfers = await StockTransfer.find()
      .populate("fromWarehouseId", "name type")
      .populate("toWarehouseId", "name type")
      .sort({ createdAt: -1 })
      .limit(100);

    sendResponse(res, 200, "Stock transfer list.", transfers);
  })
);

inventoryRoutes.get(
  "/low-stock",
  asyncHandler(async (_req, res) => {
    const stocks = await WarehouseStock.find()
      .populate({
        path: "productVariantId",
        select: "name sku lowStockAlertQty saleUnit",
        populate: [
          { path: "brandId", select: "name" },
          { path: "sizeId", select: "name" }
        ]
      })
      .populate("warehouseId", "name type");

    const lowStock = stocks.filter((s: any) => {
      const variant = s.productVariantId;
      return variant && s.quantity > 0 && s.quantity <= variant.lowStockAlertQty;
    });

    sendResponse(res, 200, "Low stock list.", lowStock);
  })
);

inventoryRoutes.get(
  "/out-of-stock",
  asyncHandler(async (_req, res) => {
    const stocks = await WarehouseStock.find({ quantity: 0 })
      .populate("warehouseId", "name type")
      .populate("productVariantId", "name sku saleUnit");

    sendResponse(res, 200, "Out of stock list.", stocks);
  })
);

inventoryRoutes.get(
  "/valuation",
  asyncHandler(async (_req, res) => {
    const stocks = await WarehouseStock.find()
      .populate("warehouseId", "name type")
      .populate("productVariantId", "name sku purchasePrice retailPrice");

    let purchaseValue = 0;
    let retailValue = 0;

    const rows = stocks.map((stock: any) => {
      const variant = stock.productVariantId;
      const pv = Number(variant?.purchasePrice || 0) * Number(stock.quantity || 0);
      const rv = Number(variant?.retailPrice || 0) * Number(stock.quantity || 0);

      purchaseValue += pv;
      retailValue += rv;

      return {
        warehouse: stock.warehouseId?.name,
        item: variant?.name,
        sku: variant?.sku,
        quantity: stock.quantity,
        purchaseValue: pv,
        retailValue: rv
      };
    });

    sendResponse(res, 200, "Inventory valuation.", {
      purchaseValue,
      retailValue,
      rows
    });
  })
);

inventoryRoutes.get(
  "/movements",
  asyncHandler(async (req, res) => {
    const productVariantId = req.query.productVariantId as string | undefined;
    const warehouseId = req.query.warehouseId as string | undefined;

    const filter: any = {};
    if (productVariantId) filter.productVariantId = productVariantId;
    if (warehouseId) filter.warehouseId = warehouseId;

    const movements = await StockMovement.find(filter)
      .populate("warehouseId", "name type")
      .populate("productVariantId", "name sku")
      .sort({ createdAt: -1 })
      .limit(300);

    sendResponse(res, 200, "Stock movement list.", movements);
  })
);
