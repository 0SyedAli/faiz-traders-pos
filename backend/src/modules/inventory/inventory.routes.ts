import { Router } from "express";
import { z } from "zod";
import { WarehouseStock } from "../../models/WarehouseStock";
import { StockMovement } from "../../models/StockMovement";
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

inventoryRoutes.get(
  "/stocks",
  asyncHandler(async (_req, res) => {
    const stocks = await WarehouseStock.find()
      .populate("warehouseId", "name type")
      .populate({
        path: "productVariantId",
        select: "name sku lowStockAlertQty saleUnit",
        populate: [
          { path: "brandId", select: "name" },
          { path: "sizeId", select: "name" }
        ]
      })
      .sort({ updatedAt: -1 });

    sendResponse(res, 200, "Warehouse stock list.", stocks);
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
      .limit(200);

    sendResponse(res, 200, "Stock movement list.", movements);
  })
);
