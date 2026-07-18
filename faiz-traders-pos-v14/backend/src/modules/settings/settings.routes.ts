import { Router } from "express";
import { z } from "zod";
import { Settings } from "../../models/Settings";
import { requireAdmin } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";

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
  defaultTaxPercentage: z.number().min(0).max(100).optional()
});

const getOrCreateSettings = async () => {
  let settings = await Settings.findOne();

  if (!settings) {
    settings = await Settings.create({
      businessName: "My Sanitary Store",
      currency: "PKR"
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
