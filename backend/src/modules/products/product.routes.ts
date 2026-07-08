import { Router } from "express";
import { z } from "zod";
import { Product } from "../../models/Product";
import { ProductVariant } from "../../models/ProductVariant";
import { WarehouseStock } from "../../models/WarehouseStock";
import { Brand } from "../../models/Brand";
import { Category } from "../../models/Category";
import { Unit } from "../../models/Unit";
import { Size } from "../../models/Size";
import { Warehouse } from "../../models/Warehouse";
import { StockMovement } from "../../models/StockMovement";
import { requireAdmin } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { ApiError } from "../../utils/apiError";

export const productRoutes = Router();

productRoutes.use(requireAdmin);

const productSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string(),
  brandId: z.string(),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

const variantSchema = z.object({
  productId: z.string(),
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().optional(),

  brandId: z.string(),
  categoryId: z.string(),
  sizeId: z.string().nullable().optional(),
  unitId: z.string(),

  saleUnit: z.enum(["piece", "length", "feet", "meter", "box", "carton", "set", "bundle", "dozen"]).optional(),
  baseUnit: z.enum(["piece", "feet", "meter"]).optional(),
  lengthPerPiece: z.number().optional(),

  purchasePrice: z.number().min(0),
  retailPrice: z.number().min(0),
  wholesalePrice: z.number().min(0).optional(),
  plumberPrice: z.number().min(0).optional(),
  dealerPrice: z.number().min(0).optional(),
  lowStockAlertQty: z.number().min(0).optional(),
  allowDecimalQty: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional()
});


const bulkVariantSchema = z.object({
  items: z.array(
    z.object({
      productName: z.string().min(1),
      variantName: z.string().min(1),
      sku: z.string().min(1),
      barcode: z.string().optional(),
      brandName: z.string().min(1),
      categoryName: z.string().min(1),
      sizeName: z.string().optional(),
      unitName: z.string().min(1),
      saleUnit: z.enum(["piece", "length", "feet", "meter", "box", "carton", "set", "bundle", "dozen"]).default("piece"),
      baseUnit: z.enum(["piece", "feet", "meter"]).default("piece"),
      lengthPerPiece: z.number().min(0).default(0),
      purchasePrice: z.number().min(0),
      retailPrice: z.number().min(0),
      wholesalePrice: z.number().min(0).optional(),
      plumberPrice: z.number().min(0).optional(),
      dealerPrice: z.number().min(0).optional(),
      lowStockAlertQty: z.number().min(0).optional(),
      allowDecimalQty: z.boolean().optional(),
      openingStock: z.number().min(0).optional(),
      warehouseName: z.string().optional()
    })
  ).min(1)
});

const findOrCreateByName = async (Model: any, name: string, extra: any = {}) => {
  const cleanName = name.trim();
  let doc = await Model.findOne({ name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } });
  if (!doc) {
    doc = await Model.create({ name: cleanName, ...extra });
  }
  return doc;
};

productRoutes.post(
  "/variants/bulk",
  asyncHandler(async (req: any, res) => {
    const body = bulkVariantSchema.parse(req.body);

    const created: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];

    for (let index = 0; index < body.items.length; index++) {
      const row = body.items[index];

      try {
        const existingSku = await ProductVariant.findOne({ sku: row.sku.trim().toUpperCase() });
        if (existingSku) {
          skipped.push({ row: index + 1, sku: row.sku, reason: "SKU already exists" });
          continue;
        }

        const brand = await findOrCreateByName(Brand, row.brandName);
        const category = await findOrCreateByName(Category, row.categoryName);

        let unit = await Unit.findOne({
          $or: [
            { name: { $regex: `^${row.unitName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
            { shortName: { $regex: `^${row.unitName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }
          ]
        });

        if (!unit) {
          unit = await Unit.create({
            name: row.unitName.trim(),
            shortName: row.unitName.trim().toLowerCase(),
            allowDecimal: Boolean(row.allowDecimalQty)
          });
        }

        let size: any = null;
        if (row.sizeName?.trim()) {
          size = await findOrCreateByName(Size, row.sizeName.trim());
        }

        let product = await Product.findOne({
          name: { $regex: `^${row.productName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
          brandId: brand._id,
          categoryId: category._id
        });

        if (!product) {
          product = await Product.create({
            name: row.productName.trim(),
            brandId: brand._id,
            categoryId: category._id,
            status: "active"
          });
        }

        const variant = await ProductVariant.create({
          productId: product._id,
          name: row.variantName.trim(),
          sku: row.sku.trim().toUpperCase(),
          barcode: row.barcode?.trim() || undefined,
          brandId: brand._id,
          categoryId: category._id,
          sizeId: size?._id || null,
          unitId: unit._id,
          saleUnit: row.saleUnit,
          baseUnit: row.baseUnit,
          lengthPerPiece: row.lengthPerPiece || 0,
          purchasePrice: row.purchasePrice,
          retailPrice: row.retailPrice,
          wholesalePrice: row.wholesalePrice || 0,
          plumberPrice: row.plumberPrice || 0,
          dealerPrice: row.dealerPrice || 0,
          lowStockAlertQty: row.lowStockAlertQty || 5,
          allowDecimalQty: Boolean(row.allowDecimalQty),
          status: "active"
        });

        if (row.openingStock && row.openingStock > 0) {
          const warehouseName = row.warehouseName?.trim() || "Main Shop";
          const warehouse = await findOrCreateByName(Warehouse, warehouseName, { type: "shop" });

          const stock = await WarehouseStock.findOneAndUpdate(
            { warehouseId: warehouse._id, productVariantId: variant._id },
            { $set: { quantity: row.openingStock } },
            { upsert: true, new: true }
          );

          await StockMovement.create({
            warehouseId: warehouse._id,
            productVariantId: variant._id,
            type: "opening_stock",
            quantity: row.openingStock,
            previousStock: 0,
            newStock: row.openingStock,
            referenceType: "bulk_import",
            note: "Opening stock from bulk product import"
          });
        }

        created.push({ row: index + 1, sku: variant.sku, name: variant.name });
      } catch (error: any) {
        errors.push({
          row: index + 1,
          sku: row.sku,
          message: error.message || "Import failed"
        });
      }
    }

    sendResponse(res, 201, "Bulk product import completed.", {
      created,
      skipped,
      errors,
      totalRows: body.items.length
    });
  })
);

productRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();

    const filter = q ? { name: { $regex: q, $options: "i" } } : {};

    const products = await Product.find(filter)
      .populate("categoryId", "name")
      .populate("brandId", "name")
      .sort({ createdAt: -1 });

    sendResponse(res, 200, "Product list.", products);
  })
);

productRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = productSchema.parse(req.body);
    const product = await Product.create(body);
    sendResponse(res, 201, "Product created.", product);
  })
);

productRoutes.get(
  "/variants",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();

    const filter = q
      ? {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { sku: { $regex: q, $options: "i" } },
            { barcode: { $regex: q, $options: "i" } }
          ]
        }
      : {};

    const variants = await ProductVariant.find(filter)
      .populate("productId", "name")
      .populate("brandId", "name")
      .populate("categoryId", "name")
      .populate("sizeId", "name")
      .populate("unitId", "name shortName")
      .sort({ createdAt: -1 })
      .limit(300);

    sendResponse(res, 200, "Product variant list.", variants);
  })
);

productRoutes.post(
  "/variants",
  asyncHandler(async (req, res) => {
    const body = variantSchema.parse(req.body);
    const variant = await ProductVariant.create({
      ...body,
      sku: body.sku.toUpperCase(),
      barcode: body.barcode || undefined,
      sizeId: body.sizeId || null
    });

    sendResponse(res, 201, "Product variant created.", variant);
  })
);

productRoutes.get(
  "/variants/:id",
  asyncHandler(async (req, res) => {
    const variant = await ProductVariant.findById(req.params.id)
      .populate("productId", "name")
      .populate("brandId", "name")
      .populate("categoryId", "name")
      .populate("sizeId", "name")
      .populate("unitId", "name shortName");

    if (!variant) throw new ApiError(404, "Product variant not found.");
    sendResponse(res, 200, "Product variant detail.", variant);
  })
);

productRoutes.put(
  "/variants/:id",
  asyncHandler(async (req, res) => {
    const body = variantSchema.partial().parse(req.body);

    const update = {
      ...body,
      ...(body.sku ? { sku: body.sku.toUpperCase() } : {}),
      ...(body.barcode === "" ? { barcode: undefined } : {}),
      ...(body.sizeId === "" ? { sizeId: null } : {})
    };

    const variant = await ProductVariant.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    });

    if (!variant) throw new ApiError(404, "Product variant not found.");
    sendResponse(res, 200, "Product variant updated.", variant);
  })
);

productRoutes.delete(
  "/variants/:id",
  asyncHandler(async (req, res) => {
    const stockDocs = await WarehouseStock.find({ productVariantId: req.params.id });
    const hasStock = stockDocs.some((stock) => stock.quantity > 0);

    if (hasStock) {
      throw new ApiError(400, "Cannot delete variant because it has stock. Set stock to 0 first.");
    }

    await WarehouseStock.deleteMany({ productVariantId: req.params.id });
    const variant = await ProductVariant.findByIdAndDelete(req.params.id);

    if (!variant) throw new ApiError(404, "Product variant not found.");
    sendResponse(res, 200, "Product variant deleted.", variant);
  })
);

productRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id)
      .populate("categoryId", "name")
      .populate("brandId", "name");

    if (!product) throw new ApiError(404, "Product not found.");
    sendResponse(res, 200, "Product detail.", product);
  })
);

productRoutes.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = productSchema.partial().parse(req.body);

    const product = await Product.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true
    });

    if (!product) throw new ApiError(404, "Product not found.");
    sendResponse(res, 200, "Product updated.", product);
  })
);

productRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const variantCount = await ProductVariant.countDocuments({ productId: req.params.id });

    if (variantCount > 0) {
      throw new ApiError(400, "Cannot delete product because it has variants. Delete variants first.");
    }

    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) throw new ApiError(404, "Product not found.");

    sendResponse(res, 200, "Product deleted.", product);
  })
);
