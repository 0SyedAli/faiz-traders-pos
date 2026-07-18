import { Router } from "express";
import { requireAdmin } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { Warehouse } from "../../models/Warehouse";
import { Category } from "../../models/Category";
import { Customer } from "../../models/Customer";
import { Settings } from "../../models/Settings";
import { ProductVariant } from "../../models/ProductVariant";
import { WarehouseStock } from "../../models/WarehouseStock";

export const offlineRoutes = Router();
offlineRoutes.use(requireAdmin);

offlineRoutes.get("/bootstrap", asyncHandler(async (_req, res) => {
  const [warehouses, categories, customers, settings, variants, stocks] = await Promise.all([
    Warehouse.find().sort({ name: 1 }).lean(),
    Category.find().sort({ name: 1 }).lean(),
    Customer.find({ status: "active" }).sort({ name: 1 }).lean(),
    Settings.findOne().lean(),
    ProductVariant.find({ status: "active" })
      .populate("brandId", "name")
      .populate("categoryId", "name")
      .sort({ name: 1 })
      .lean(),
    WarehouseStock.find().lean(),
  ]);

  const variantMap = new Map(variants.map((variant: any) => [String(variant._id), variant]));
  const products = stocks.map((stock: any) => {
    const variant: any = variantMap.get(String(stock.productVariantId));
    if (!variant) return null;
    return {
      _id: String(variant._id),
      warehouseId: String(stock.warehouseId),
      categoryId: String(variant.categoryId?._id || variant.categoryId || ""),
      name: variant.name,
      sku: variant.sku,
      brand: variant.brandId?.name === "No Brand" ? "" : variant.brandId?.name || "",
      category: variant.categoryId?.name || "",
      size: variant.sizeLabel || "",
      gauge: variant.gauge || "",
      lengthFeet: Number(variant.lengthFeet || 0),
      purchasePrice: Number(variant.purchasePrice || 0),
      retailPrice: Number(variant.retailPrice || 0),
      wholesalePrice: Number(variant.wholesalePrice || 0),
      distributorPrice: Number(variant.distributorPrice || variant.dealerPrice || 0),
      dealerPrice: Number(variant.distributorPrice || variant.dealerPrice || 0),
      stockQty: Number(stock.quantity || 0),
      status: variant.status,
      updatedAt: stock.updatedAt || variant.updatedAt,
    };
  }).filter(Boolean);

  sendResponse(res, 200, "Offline database bootstrap.", {
    serverTime: new Date().toISOString(),
    warehouses,
    categories,
    customers,
    settings,
    products,
  });
}));
