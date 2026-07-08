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

const clean = (value?: string | null) => String(value || "").trim();
const cleanUpper = (value?: string | null) => clean(value).toUpperCase();

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const exactNameQuery = (name: string) => ({
  $regex: `^${escapeRegex(clean(name))}$`,
  $options: "i"
});

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
  gauge: z.string().optional(),
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
      gauge: z.string().optional(),
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
  const cleanName = clean(name);
  let doc = await Model.findOne({ name: exactNameQuery(cleanName) });
  if (!doc) {
    doc = await Model.create({ name: cleanName, ...extra });
  }
  return doc;
};

const ensureNoDuplicateProduct = async ({
  name,
  categoryId,
  brandId,
  excludeId
}: {
  name: string;
  categoryId: string;
  brandId: string;
  excludeId?: string;
}) => {
  const filter: any = {
    name: exactNameQuery(name),
    categoryId,
    brandId
  };

  if (excludeId) filter._id = { $ne: excludeId };

  const duplicate = await Product.findOne(filter)
    .populate("brandId", "name")
    .populate("categoryId", "name");

  if (duplicate) {
    throw new ApiError(
      400,
      `Duplicate product restricted: "${name}" already exists in brand "${(duplicate.brandId as any)?.name || "same brand"}" and category "${(duplicate.categoryId as any)?.name || "same category"}".`
    );
  }
};

const ensureNoDuplicateVariant = async ({
  productId,
  brandId,
  categoryId,
  sizeId,
  gauge,
  saleUnit,
  sku,
  barcode,
  excludeId
}: {
  productId: string;
  brandId: string;
  categoryId: string;
  sizeId?: string | null;
  gauge?: string;
  saleUnit?: string;
  sku?: string;
  barcode?: string;
  excludeId?: string;
}) => {
  const normalizedSku = cleanUpper(sku);
  if (normalizedSku) {
    const skuFilter: any = { sku: normalizedSku };
    if (excludeId) skuFilter._id = { $ne: excludeId };
    const duplicateSku = await ProductVariant.findOne(skuFilter);
    if (duplicateSku) {
      throw new ApiError(400, `Duplicate SKU restricted: "${normalizedSku}" already exists.`);
    }
  }

  const normalizedBarcode = clean(barcode);
  if (normalizedBarcode) {
    const barcodeFilter: any = { barcode: normalizedBarcode };
    if (excludeId) barcodeFilter._id = { $ne: excludeId };
    const duplicateBarcode = await ProductVariant.findOne(barcodeFilter);
    if (duplicateBarcode) {
      throw new ApiError(400, `Duplicate barcode restricted: "${normalizedBarcode}" already exists.`);
    }
  }

  const variantFilter: any = {
    productId,
    brandId,
    categoryId,
    sizeId: sizeId || null,
    gauge: clean(gauge),
    saleUnit: saleUnit || "piece"
  };

  if (excludeId) variantFilter._id = { $ne: excludeId };

  const duplicateVariant = await ProductVariant.findOne(variantFilter)
    .populate("productId", "name")
    .populate("brandId", "name")
    .populate("categoryId", "name")
    .populate("sizeId", "name");

  if (duplicateVariant) {
    const sizeName = (duplicateVariant.sizeId as any)?.name || "no size";
    const gaugeText = clean(gauge) || "no gauge";
    throw new ApiError(
      400,
      `Duplicate variant restricted: ${(duplicateVariant.productId as any)?.name || "Product"} / ${(duplicateVariant.brandId as any)?.name || "Brand"} / size ${sizeName} / gauge ${gaugeText} already exists.`
    );
  }
};

const handleDuplicateMongoError = (error: any) => {
  if (error?.code === 11000) {
    const key = Object.keys(error.keyPattern || error.keyValue || {})[0] || "record";
    throw new ApiError(400, `Duplicate ${key} restricted. This product/variant already exists.`);
  }
  throw error;
};

productRoutes.post(
  "/variants/bulk",
  asyncHandler(async (req: any, res) => {
    const body = bulkVariantSchema.parse(req.body);

    const created: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];

    const seenSku = new Map<string, number>();
    const seenBarcode = new Map<string, number>();
    const seenCombo = new Map<string, number>();

    for (let index = 0; index < body.items.length; index++) {
      const row = body.items[index];
      const rowNo = index + 2; // Excel/CSV row number including header

      const skuKey = cleanUpper(row.sku);
      const barcodeKey = clean(row.barcode);
      const comboKey = [
        clean(row.productName).toLowerCase(),
        clean(row.brandName).toLowerCase(),
        clean(row.categoryName).toLowerCase(),
        clean(row.sizeName).toLowerCase(),
        clean(row.gauge).toLowerCase(),
        clean(row.saleUnit).toLowerCase()
      ].join("|");

      if (seenSku.has(skuKey)) {
        errors.push({
          row: rowNo,
          sku: row.sku,
          message: `Duplicate upload row: SKU "${row.sku}" is already used in row ${seenSku.get(skuKey)}.`
        });
        continue;
      }
      seenSku.set(skuKey, rowNo);

      if (barcodeKey) {
        if (seenBarcode.has(barcodeKey)) {
          errors.push({
            row: rowNo,
            sku: row.sku,
            message: `Duplicate upload row: barcode "${barcodeKey}" is already used in row ${seenBarcode.get(barcodeKey)}.`
          });
          continue;
        }
        seenBarcode.set(barcodeKey, rowNo);
      }

      if (seenCombo.has(comboKey)) {
        errors.push({
          row: rowNo,
          sku: row.sku,
          message: `Duplicate upload row: same product/brand/category/size/gauge/saleUnit already exists in row ${seenCombo.get(comboKey)}.`
        });
        continue;
      }
      seenCombo.set(comboKey, rowNo);

      try {
        const brand = await findOrCreateByName(Brand, row.brandName);
        const category = await findOrCreateByName(Category, row.categoryName);

        let unit = await Unit.findOne({
          $or: [
            { name: exactNameQuery(row.unitName) },
            { shortName: exactNameQuery(row.unitName) }
          ]
        });

        if (!unit) {
          unit = await Unit.create({
            name: clean(row.unitName),
            shortName: clean(row.unitName).toLowerCase(),
            allowDecimal: Boolean(row.allowDecimalQty)
          });
        }

        let size: any = null;
        if (clean(row.sizeName)) {
          size = await findOrCreateByName(Size, clean(row.sizeName));
        }

        let product = await Product.findOne({
          name: exactNameQuery(row.productName),
          brandId: brand._id,
          categoryId: category._id
        });

        if (!product) {
          product = await Product.create({
            name: clean(row.productName),
            brandId: brand._id,
            categoryId: category._id,
            status: "active"
          });
        }

        await ensureNoDuplicateVariant({
          productId: String(product._id),
          brandId: String(brand._id),
          categoryId: String(category._id),
          sizeId: size?._id ? String(size._id) : null,
          gauge: row.gauge,
          saleUnit: row.saleUnit,
          sku: row.sku,
          barcode: row.barcode
        });

        const variant = await ProductVariant.create({
          productId: product._id,
          name: clean(row.variantName),
          sku: skuKey,
          barcode: barcodeKey || undefined,
          brandId: brand._id,
          categoryId: category._id,
          sizeId: size?._id || null,
          gauge: clean(row.gauge),
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
          const warehouseName = clean(row.warehouseName) || "Main Shop";
          const warehouse = await findOrCreateByName(Warehouse, warehouseName, { type: "shop" });

          await WarehouseStock.findOneAndUpdate(
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

        created.push({ row: rowNo, sku: variant.sku, name: variant.name });
      } catch (error: any) {
        errors.push({
          row: rowNo,
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

    await ensureNoDuplicateProduct({
      name: body.name,
      categoryId: body.categoryId,
      brandId: body.brandId
    });

    try {
      const product = await Product.create({
        ...body,
        name: clean(body.name)
      });
      sendResponse(res, 201, "Product created.", product);
    } catch (error: any) {
      handleDuplicateMongoError(error);
    }
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
            { barcode: { $regex: q, $options: "i" } },
            { gauge: { $regex: q, $options: "i" } }
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

    await ensureNoDuplicateVariant({
      productId: body.productId,
      brandId: body.brandId,
      categoryId: body.categoryId,
      sizeId: body.sizeId || null,
      gauge: body.gauge,
      saleUnit: body.saleUnit || "piece",
      sku: body.sku,
      barcode: body.barcode
    });

    try {
      const variant = await ProductVariant.create({
        ...body,
        name: clean(body.name),
        sku: cleanUpper(body.sku),
        barcode: clean(body.barcode) || undefined,
        sizeId: body.sizeId || null,
        gauge: clean(body.gauge)
      });

      sendResponse(res, 201, "Product variant created.", variant);
    } catch (error: any) {
      handleDuplicateMongoError(error);
    }
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

    const existing = await ProductVariant.findById(req.params.id);
    if (!existing) throw new ApiError(404, "Product variant not found.");

    await ensureNoDuplicateVariant({
      productId: body.productId || String(existing.productId),
      brandId: body.brandId || String(existing.brandId),
      categoryId: body.categoryId || String(existing.categoryId),
      sizeId: body.sizeId === undefined ? (existing.sizeId ? String(existing.sizeId) : null) : (body.sizeId || null),
      gauge: body.gauge === undefined ? existing.gauge : body.gauge,
      saleUnit: body.saleUnit || existing.saleUnit,
      sku: body.sku || existing.sku,
      barcode: body.barcode === undefined ? existing.barcode : body.barcode,
      excludeId: req.params.id
    });

    const update = {
      ...body,
      ...(body.name ? { name: clean(body.name) } : {}),
      ...(body.sku ? { sku: cleanUpper(body.sku) } : {}),
      ...(body.barcode === "" ? { barcode: undefined } : body.barcode ? { barcode: clean(body.barcode) } : {}),
      ...(body.sizeId === "" ? { sizeId: null } : {}),
      ...(body.gauge !== undefined ? { gauge: clean(body.gauge) } : {})
    };

    try {
      const variant = await ProductVariant.findByIdAndUpdate(req.params.id, update, {
        new: true,
        runValidators: true
      });

      if (!variant) throw new ApiError(404, "Product variant not found.");
      sendResponse(res, 200, "Product variant updated.", variant);
    } catch (error: any) {
      handleDuplicateMongoError(error);
    }
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

    const existing = await Product.findById(req.params.id);
    if (!existing) throw new ApiError(404, "Product not found.");

    await ensureNoDuplicateProduct({
      name: body.name || existing.name,
      categoryId: body.categoryId || String(existing.categoryId),
      brandId: body.brandId || String(existing.brandId),
      excludeId: req.params.id
    });

    try {
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { ...body, ...(body.name ? { name: clean(body.name) } : {}) },
        {
          new: true,
          runValidators: true
        }
      );

      if (!product) throw new ApiError(404, "Product not found.");
      sendResponse(res, 200, "Product updated.", product);
    } catch (error: any) {
      handleDuplicateMongoError(error);
    }
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
