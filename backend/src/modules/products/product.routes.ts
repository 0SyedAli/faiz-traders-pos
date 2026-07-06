import { Router } from "express";
import { z } from "zod";
import { Product } from "../../models/Product";
import { ProductVariant } from "../../models/ProductVariant";
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
      .limit(100);

    sendResponse(res, 200, "Product variant list.", variants);
  })
);

productRoutes.post(
  "/variants",
  asyncHandler(async (req, res) => {
    const body = variantSchema.parse(req.body);
    const variant = await ProductVariant.create({
      ...body,
      sku: body.sku.toUpperCase()
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
    const update = body.sku ? { ...body, sku: body.sku.toUpperCase() } : body;

    const variant = await ProductVariant.findByIdAndUpdate(req.params.id, update, {
      new: true
    });

    if (!variant) throw new ApiError(404, "Product variant not found.");
    sendResponse(res, 200, "Product variant updated.", variant);
  })
);
