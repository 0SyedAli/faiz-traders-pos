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
import {
  CATEGORY_CONFIGS,
  buildDuplicateKey,
  buildSearchText,
  getCategoryConfigByName,
  getCategorySearchAliases
} from "../../utils/categoryConfig";

export const productRoutes = Router();
productRoutes.use(requireAdmin);

const clean = (value?: string | null) => String(value || "").trim();
const cleanUpper = (value?: string | null) => clean(value).toUpperCase();
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactNameQuery = (name: string) => ({ $regex: `^${escapeRegex(clean(name))}$`, $options: "i" });

const productSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string(),
  brandId: z.string().optional().nullable(),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

const dynamicVariantSchema = z.object({
  // Product Name in the new simplified flow.
  name: z.string().min(1),
  productName: z.string().optional(),
  productId: z.string().optional().nullable(),
  sku: z.string().optional(),

  categoryId: z.string(),
  brandId: z.string().optional().nullable(),
  brandName: z.string().optional(),

  sizeLabel: z.string().optional(),
  sizeName: z.string().optional(),
  sizeId: z.string().optional().nullable(),
  gauge: z.string().optional(),
  lengthFeet: z.number().min(0).optional(),

  purchasePrice: z.number().min(0),
  retailPrice: z.number().min(0),
  wholesalePrice: z.number().min(0).optional(),
  distributorPrice: z.number().min(0).optional(),
  dealerPrice: z.number().min(0).optional(),
  plumberPrice: z.number().min(0).optional(),

  stock: z.number().min(0).optional(),
  openingStock: z.number().min(0).optional(),
  minimumStock: z.number().min(0).optional(),
  lowStockAlertQty: z.number().min(0).optional(),
  warehouseId: z.string().optional().nullable(),
  warehouseName: z.string().optional(),

  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

const bulkVariantSchema = z.object({
  items: z.array(
    z.object({
      categoryName: z.string().min(1),
      productName: z.string().min(1),
      brandName: z.string().optional(),
      size: z.string().optional(),
      sizeName: z.string().optional(),
      gauge: z.string().optional(),
      lengthFeet: z.number().min(0).optional(),
      sku: z.string().optional(),
      purchasePrice: z.number().min(0),
      retailPrice: z.number().min(0),
      wholesalePrice: z.number().min(0).optional(),
      distributorPrice: z.number().min(0).optional(),
      stock: z.number().min(0).optional(),
      openingStock: z.number().min(0).optional(),
      minimumStock: z.number().min(0).optional(),
      warehouseName: z.string().optional(),
      description: z.string().optional()
    })
  ).min(1)
});

const findOrCreateByName = async (Model: any, name: string, extra: any = {}) => {
  const cleanName = clean(name);
  let doc = await Model.findOne({ name: exactNameQuery(cleanName) });
  if (!doc) doc = await Model.create({ name: cleanName, ...extra });
  return doc;
};

const getDefaultUnit = async () => {
  return findOrCreateByName(Unit, "Piece", { shortName: "pcs", allowDecimal: false });
};

const getDefaultBrand = async () => {
  return findOrCreateByName(Brand, "No Brand");
};

const getMainShop = async (warehouseName?: string) => {
  return findOrCreateByName(Warehouse, clean(warehouseName) || "Main Shop", { type: "shop" });
};

const createSku = async (categoryName: string) => {
  const prefix = clean(categoryName)
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 4) || "PRD";
  const count = await ProductVariant.countDocuments();
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
};

const getLengthByCategory = (categoryName: string, inputLength?: number) => {
  const config = getCategoryConfigByName(categoryName);
  if (config?.fixedLengthFeet !== undefined) return config.fixedLengthFeet;
  return Number(inputLength || 0);
};

const getSaleUnitByCategory = (categoryName: string) => {
  const config = getCategoryConfigByName(categoryName);
  return config?.fields.includes("lengthFeet") ? "length" : "piece";
};

const validateDynamicFields = ({ categoryName, brandId, sizeLabel, gauge }: any) => {
  const config = getCategoryConfigByName(categoryName);
  if (!config) return;

  if (config.fields.includes("brand") && config.brandRequired && !brandId) {
    throw new ApiError(400, `${config.label}: brand is required.`);
  }

  if (config.fields.includes("size") && !clean(sizeLabel)) {
    throw new ApiError(400, `${config.label}: size is required.`);
  }

  if (config.fields.includes("gauge") && config.gaugeRequired && !clean(gauge)) {
    throw new ApiError(400, `${config.label}: gauge/thickness is required.`);
  }
};

const ensureVariantDuplicateFree = async ({ duplicateKey, sku, excludeId }: { duplicateKey: string; sku: string; excludeId?: string }) => {
  const skuFilter: any = { sku: cleanUpper(sku) };
  if (excludeId) skuFilter._id = { $ne: excludeId };
  const duplicateSku = await ProductVariant.findOne(skuFilter);
  if (duplicateSku) throw new ApiError(400, `Duplicate SKU restricted: "${sku}" already exists.`);

  const filter: any = { duplicateKey };
  if (excludeId) filter._id = { $ne: excludeId };
  const duplicate = await ProductVariant.findOne(filter).populate("categoryId", "name").populate("brandId", "name");
  if (duplicate) {
    throw new ApiError(400, `Duplicate product restricted: "${duplicate.name}" / ${(duplicate.categoryId as any)?.name || "same category"} / size ${duplicate.sizeLabel || "-"} / gauge ${duplicate.gauge || "-"} already exists.`);
  }
};

const getOrCreateStock = async (warehouseId: string, productVariantId: string, qty: number) => {
  const existing = await WarehouseStock.findOne({ warehouseId, productVariantId });
  if (existing) {
    existing.quantity = qty;
    await existing.save();
    return existing;
  }
  return WarehouseStock.create({ warehouseId, productVariantId, quantity: qty });
};

const prepareVariantPayload = async (raw: z.infer<typeof dynamicVariantSchema>) => {
  const category = await Category.findById(raw.categoryId);
  if (!category) throw new ApiError(404, "Category not found.");

  const categoryName = category.name;
  const config = getCategoryConfigByName(categoryName);

  let brand: any = null;
  const brandShouldBeUsed = config?.fields.includes("brand") || clean(raw.brandId) || clean(raw.brandName);
  if (brandShouldBeUsed) {
    brand = raw.brandId ? await Brand.findById(raw.brandId) : await findOrCreateByName(Brand, raw.brandName || "No Brand");
  } else {
    brand = await getDefaultBrand();
  }

  const sizeLabel = clean(raw.sizeLabel || raw.sizeName) || (raw.sizeId ? clean((await Size.findById(raw.sizeId))?.name) : "");
  const gauge = config?.fields.includes("gauge") ? clean(raw.gauge) : "";
  const lengthFeet = getLengthByCategory(categoryName, raw.lengthFeet);
  const name = clean(raw.name || raw.productName);

  validateDynamicFields({ categoryName, brandId: brand?._id, sizeLabel, gauge });

  const productNameForGroup = name;
  let product = raw.productId ? await Product.findById(raw.productId) : null;
  if (!product) {
    product = await Product.findOne({
      name: exactNameQuery(productNameForGroup),
      categoryId: category._id,
      brandId: brand?._id || null
    });
  }
  if (!product) {
    product = await Product.create({
      name: productNameForGroup,
      categoryId: category._id,
      brandId: brand?._id || null,
      description: raw.description || "",
      status: raw.status || "active"
    });
  }

  const unit = await getDefaultUnit();
  const sku = cleanUpper(raw.sku) || await createSku(categoryName);
  const duplicateKey = buildDuplicateKey({
    name,
    categoryName,
    brandName: brand?.name || "",
    sizeLabel,
    gauge,
    lengthFeet
  });
  const searchText = buildSearchText({
    name,
    categoryName,
    brandName: brand?.name || "",
    sizeLabel,
    gauge,
    sku
  });
  const saleUnit = getSaleUnitByCategory(categoryName);

  return {
    product,
    category,
    brand,
    unit,
    variant: {
      productId: product._id,
      name,
      sku,
      categoryId: category._id,
      brandId: brand?._id || null,
      sizeId: raw.sizeId || null,
      sizeLabel,
      gauge,
      lengthFeet,
      unitId: unit._id,
      saleUnit,
      baseUnit: saleUnit === "length" ? "feet" : "piece",
      lengthPerPiece: lengthFeet,
      purchasePrice: raw.purchasePrice,
      retailPrice: raw.retailPrice,
      wholesalePrice: raw.wholesalePrice || 0,
      distributorPrice: raw.distributorPrice || raw.dealerPrice || 0,
      dealerPrice: raw.distributorPrice || raw.dealerPrice || 0,
      plumberPrice: raw.wholesalePrice || 0,
      minimumStock: raw.minimumStock || raw.lowStockAlertQty || 5,
      lowStockAlertQty: raw.minimumStock || raw.lowStockAlertQty || 5,
      allowDecimalQty: false,
      description: raw.description || "",
      searchText,
      duplicateKey,
      status: raw.status || "active"
    },
    stock: raw.stock ?? raw.openingStock ?? 0,
    warehouseId: raw.warehouseId,
    warehouseName: raw.warehouseName
  };
};

productRoutes.get("/category-config", asyncHandler(async (_req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  const existingNames = new Set(categories.map((category) => category.name.toLowerCase()));
  for (const config of CATEGORY_CONFIGS) {
    if (!existingNames.has(config.label.toLowerCase())) {
      await Category.create({ name: config.label });
    }
  }

  const refreshed = await Category.find().sort({ name: 1 });
  const data = refreshed.map((category) => {
    const config = getCategoryConfigByName(category.name);
    return {
      _id: category._id,
      name: category.name,
      config: config || {
        key: category.name.toLowerCase().replace(/\s+/g, "-"),
        label: category.name,
        aliases: [category.name],
        fields: ["brand", "size", "description", "minimumStock"],
        sizes: []
      }
    };
  });

  sendResponse(res, 200, "Category dynamic configs.", data);
}));

productRoutes.get("/", asyncHandler(async (_req, res) => {
  const products = await Product.find()
    .populate("brandId", "name")
    .populate("categoryId", "name")
    .sort({ createdAt: -1 });
  sendResponse(res, 200, "Product list.", products);
}));

productRoutes.post("/", asyncHandler(async (req, res) => {
  const body = productSchema.parse(req.body);
  const product = await Product.create({ ...body, brandId: body.brandId || null });
  sendResponse(res, 201, "Product created.", product);
}));

productRoutes.put("/:id", asyncHandler(async (req, res) => {
  const body = productSchema.partial().parse(req.body);
  const product = await Product.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!product) throw new ApiError(404, "Product not found.");
  sendResponse(res, 200, "Product updated.", product);
}));

productRoutes.delete("/:id", asyncHandler(async (req, res) => {
  const linked = await ProductVariant.countDocuments({ productId: req.params.id });
  if (linked > 0) throw new ApiError(400, "Cannot delete product group with variants.");
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new ApiError(404, "Product not found.");
  sendResponse(res, 200, "Product deleted.", product);
}));

productRoutes.get("/variants", asyncHandler(async (req, res) => {
  const q = clean(req.query.q as string);
  const categoryId = clean(req.query.categoryId as string);
  const filter: any = {};
  if (categoryId) filter.categoryId = categoryId;
  if (q) {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    filter.$and = tokens.map((token) => ({ searchText: { $regex: escapeRegex(token), $options: "i" } }));
  }

  const variants = await ProductVariant.find(filter)
    .populate("productId", "name")
    .populate("brandId", "name")
    .populate("categoryId", "name")
    .populate("sizeId", "name")
    .sort({ name: 1 })
    .limit(1000);

  sendResponse(res, 200, "Variant list.", variants);
}));

productRoutes.post("/variants", asyncHandler(async (req, res) => {
  const body = dynamicVariantSchema.parse(req.body);
  const prepared = await prepareVariantPayload(body);
  await ensureVariantDuplicateFree({ duplicateKey: prepared.variant.duplicateKey, sku: prepared.variant.sku });

  const variant = await ProductVariant.create(prepared.variant);

  if (prepared.stock > 0) {
    const warehouse = prepared.warehouseId ? await Warehouse.findById(prepared.warehouseId) : await getMainShop(prepared.warehouseName);
    if (!warehouse) throw new ApiError(404, "Warehouse not found.");
    await getOrCreateStock(String(warehouse._id), String(variant._id), prepared.stock);
    await StockMovement.create({
      warehouseId: warehouse._id,
      productVariantId: variant._id,
      type: "opening_stock",
      quantity: prepared.stock,
      previousStock: 0,
      newStock: prepared.stock,
      referenceType: "product_create",
      note: "Opening stock from product form"
    });
  }

  sendResponse(res, 201, "Product created.", variant);
}));

productRoutes.get("/variants/:id", asyncHandler(async (req, res) => {
  const variant = await ProductVariant.findById(req.params.id)
    .populate("productId", "name")
    .populate("brandId", "name")
    .populate("categoryId", "name")
    .populate("sizeId", "name");
  if (!variant) throw new ApiError(404, "Variant not found.");
  sendResponse(res, 200, "Variant detail.", variant);
}));

productRoutes.put("/variants/:id", asyncHandler(async (req, res) => {
  const body = dynamicVariantSchema.parse(req.body);
  const existing = await ProductVariant.findById(req.params.id);
  if (!existing) throw new ApiError(404, "Variant not found.");

  const prepared = await prepareVariantPayload(body);
  await ensureVariantDuplicateFree({ duplicateKey: prepared.variant.duplicateKey, sku: prepared.variant.sku, excludeId: String(req.params.id) });

  const variant = await ProductVariant.findByIdAndUpdate(req.params.id, prepared.variant, { new: true, runValidators: true });

  if (prepared.stock >= 0) {
    const warehouse = prepared.warehouseId ? await Warehouse.findById(prepared.warehouseId) : await getMainShop(prepared.warehouseName);
    if (warehouse && variant) {
      const previous = await WarehouseStock.findOne({ warehouseId: warehouse._id, productVariantId: variant._id });
      const previousStock = Number(previous?.quantity || 0);
      await getOrCreateStock(String(warehouse._id), String(variant._id), prepared.stock);
      if (previousStock !== prepared.stock) {
        await StockMovement.create({
          warehouseId: warehouse._id,
          productVariantId: variant._id,
          type: "adjustment",
          quantity: prepared.stock - previousStock,
          previousStock,
          newStock: prepared.stock,
          referenceType: "product_update",
          note: "Stock updated from product form"
        });
      }
    }
  }

  sendResponse(res, 200, "Product updated.", variant);
}));

productRoutes.delete("/variants/:id", asyncHandler(async (req, res) => {
  const stock = await WarehouseStock.findOne({ productVariantId: req.params.id, quantity: { $gt: 0 } });
  if (stock) throw new ApiError(400, "Cannot delete product with stock. Set stock to 0 first.");
  const variant = await ProductVariant.findByIdAndDelete(req.params.id);
  if (!variant) throw new ApiError(404, "Variant not found.");
  sendResponse(res, 200, "Variant deleted.", variant);
}));

productRoutes.post("/variants/bulk", asyncHandler(async (req, res) => {
  const body = bulkVariantSchema.parse(req.body);
  const created: any[] = [];
  const skipped: any[] = [];
  const errors: any[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < body.items.length; i++) {
    const row = body.items[i];
    const rowNo = i + 2;
    try {
      const category = await findOrCreateByName(Category, row.categoryName);
      const config = getCategoryConfigByName(category.name);
      const lengthFeet = getLengthByCategory(category.name, row.lengthFeet);
      const brandName = config?.fields.includes("brand") ? clean(row.brandName || "No Brand") : "";
      const key = buildDuplicateKey({ name: row.productName, categoryName: category.name, brandName, sizeLabel: row.size || row.sizeName || "", gauge: row.gauge || "", lengthFeet });
      if (seen.has(key)) {
        errors.push({ row: rowNo, sku: row.sku || "", message: `Duplicate row: same product already exists in row ${seen.get(key)}.` });
        continue;
      }
      seen.set(key, rowNo);

      const brand = brandName ? await findOrCreateByName(Brand, brandName) : await getDefaultBrand();
      const sku = cleanUpper(row.sku) || await createSku(category.name);

      const payload = {
        name: row.productName,
        sku,
        categoryId: String(category._id),
        brandId: brandName ? String(brand._id) : undefined,
        sizeLabel: row.size || row.sizeName || "",
        gauge: row.gauge || "",
        lengthFeet,
        purchasePrice: row.purchasePrice,
        retailPrice: row.retailPrice,
        wholesalePrice: row.wholesalePrice || 0,
        distributorPrice: row.distributorPrice || 0,
        stock: row.stock ?? row.openingStock ?? 0,
        minimumStock: row.minimumStock || 5,
        warehouseName: row.warehouseName || "Main Shop",
        description: row.description || ""
      };

      const prepared = await prepareVariantPayload(payload);
      await ensureVariantDuplicateFree({ duplicateKey: prepared.variant.duplicateKey, sku: prepared.variant.sku });
      const variant = await ProductVariant.create(prepared.variant);

      if (prepared.stock > 0) {
        const warehouse = await getMainShop(prepared.warehouseName);
        await getOrCreateStock(String(warehouse._id), String(variant._id), prepared.stock);
        await StockMovement.create({
          warehouseId: warehouse._id,
          productVariantId: variant._id,
          type: "opening_stock",
          quantity: prepared.stock,
          previousStock: 0,
          newStock: prepared.stock,
          referenceType: "bulk_import",
          note: "Opening stock from bulk product import"
        });
      }

      created.push({ row: rowNo, sku: variant.sku, name: variant.name });
    } catch (error: any) {
      errors.push({ row: rowNo, sku: row.sku || "", message: error.message || "Import failed" });
    }
  }

  sendResponse(res, 201, "Bulk product import completed.", { created, skipped, errors, totalRows: body.items.length });
}));
