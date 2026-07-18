import { Router } from "express";
import { z } from "zod";
import { Brand } from "../../models/Brand";
import { Category } from "../../models/Category";
import { Unit } from "../../models/Unit";
import { Size } from "../../models/Size";
import { Warehouse } from "../../models/Warehouse";
import { requireAdmin } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { ApiError } from "../../utils/apiError";

export const masterRoutes = Router();

masterRoutes.use(requireAdmin);

const simpleNameSchema = z.object({
  name: z.string().min(1),
  status: z.enum(["active", "inactive"]).optional()
});

const unitSchema = z.object({
  name: z.string().min(1),
  shortName: z.string().min(1),
  allowDecimal: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

const sizeSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

const warehouseSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["shop", "godown"]).default("shop"),
  address: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

const categorySchema = z.object({
  name: z.string().min(1),
  parentId: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

const crud = (Model: any, schema: any, label: string) => {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (_req, res) => {
      const docs = await Model.find().sort({ createdAt: -1 });
      sendResponse(res, 200, `${label} list.`, docs);
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = schema.parse(req.body);
      const doc = await Model.create(body);
      sendResponse(res, 201, `${label} created.`, doc);
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) throw new ApiError(404, `${label} not found.`);
      sendResponse(res, 200, `${label} detail.`, doc);
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      const body = schema.partial().parse(req.body);
      const doc = await Model.findByIdAndUpdate(req.params.id, body, { new: true });
      if (!doc) throw new ApiError(404, `${label} not found.`);
      sendResponse(res, 200, `${label} updated.`, doc);
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const doc = await Model.findByIdAndDelete(req.params.id);
      if (!doc) throw new ApiError(404, `${label} not found.`);
      sendResponse(res, 200, `${label} deleted.`, doc);
    })
  );

  return router;
};

masterRoutes.use("/brands", crud(Brand, simpleNameSchema, "Brand"));
masterRoutes.use("/categories", crud(Category, categorySchema, "Category"));
masterRoutes.use("/units", crud(Unit, unitSchema, "Unit"));
masterRoutes.use("/sizes", crud(Size, sizeSchema, "Size"));
masterRoutes.use("/warehouses", crud(Warehouse, warehouseSchema, "Warehouse"));
