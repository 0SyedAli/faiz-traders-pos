import { Router } from "express";
import { z } from "zod";
import { Settings } from "../../models/Settings";
import { requireAdmin } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { ApiError } from "../../utils/apiError";

export const settingsRoutes = Router();

settingsRoutes.use(requireAdmin);

const settingsSchema = z.object({
  businessName: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  currency: z.string().min(1).optional(),

  invoicePrefix: z.string().min(1).optional(),
  purchasePrefix: z.string().min(1).optional(),
  quotationPrefix: z.string().min(1).optional(),

  taxEnabled: z.boolean().optional(),
  defaultTaxPercentage: z.number().min(0).max(100).optional(),
  saleTypes: z.array(z.object({
    key: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1)
  })).min(1).refine((rows) => new Set(rows.map((row) => row.key)).size === rows.length, "Sale type names must be unique.").optional()
});
const saleTypeSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(1)
});

const getOrCreateSettings = async () => {
  let settings = await Settings.findOne();

  if (!settings) {
    settings = await Settings.create({
      businessName: "My Sanitary Store",
      currency: "PKR",
      saleTypes: [{ key: "retail", name: "Retail" }, { key: "wholesale", name: "Wholesale" }]
    });
  }

  return settings;
};

settingsRoutes.get(
  "/",
  asyncHandler(async (_req, res) => {
    const settings = await getOrCreateSettings();
    sendResponse(res, 200, "Settings detail.", settings);
  })
);

settingsRoutes.put(
  "/",
  asyncHandler(async (req, res) => {
    const body = settingsSchema.parse(req.body);
    const current = await getOrCreateSettings();

    const settings = await Settings.findByIdAndUpdate(current._id, body, {
      new: true,
      runValidators: true
    });

    sendResponse(res, 200, "Settings updated.", settings);
  })
);

settingsRoutes.post(
  "/sale-types",
  asyncHandler(async (req, res) => {
    const saleType = saleTypeSchema.parse(req.body);
    const settings = await getOrCreateSettings();
    if (settings.saleTypes.some((item: any) => item.key === saleType.key)) {
      throw new ApiError(409, "This sale type already exists.");
    }
    settings.saleTypes.push(saleType as any);
    await settings.save();
    sendResponse(res, 201, "Sale type added.", settings);
  })
);

settingsRoutes.delete(
  "/sale-types/:key",
  asyncHandler(async (req, res) => {
    const settings = await getOrCreateSettings();
    if (settings.saleTypes.length <= 1) {
      throw new ApiError(400, "At least one sale type is required.");
    }
    const nextSaleTypes = settings.saleTypes.filter((item: any) => item.key !== req.params.key);
    if (nextSaleTypes.length === settings.saleTypes.length) {
      throw new ApiError(404, "Sale type not found.");
    }
    settings.set("saleTypes", nextSaleTypes);
    await settings.save();
    sendResponse(res, 200, "Sale type deleted.", settings);
  })
);
