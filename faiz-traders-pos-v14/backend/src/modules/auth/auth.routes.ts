import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AdminUser } from "../../models/AdminUser";
import { ApiError } from "../../utils/apiError";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { generateToken } from "../../utils/generateToken";
import { env } from "../../config/env";
import { requireAdmin, AuthRequest } from "../../middlewares/auth.middleware";

export const authRoutes = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const setupSchema = z.object({
  setupKey: z.string(),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6)
});

authRoutes.post(
  "/setup-admin",
  asyncHandler(async (req, res) => {
    const body = setupSchema.parse(req.body);

    if (body.setupKey !== env.ADMIN_SETUP_KEY) {
      throw new ApiError(403, "Invalid setup key.");
    }

    const adminCount = await AdminUser.countDocuments();
    if (adminCount > 0) {
      throw new ApiError(400, "Admin already exists.");
    }

    const hashed = await bcrypt.hash(body.password, 10);

    const admin = await AdminUser.create({
      name: body.name,
      email: body.email,
      phone: body.phone,
      password: hashed,
      role: "admin"
    });

    const token = generateToken({ id: admin._id, role: "admin" });

    sendResponse(res, 201, "Admin created successfully.", {
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  })
);

authRoutes.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);

    const admin = await AdminUser.findOne({ email: body.email }).select("+password");
    if (!admin) throw new ApiError(401, "Invalid email or password.");

    const isMatch = await bcrypt.compare(body.password, admin.password);
    if (!isMatch) throw new ApiError(401, "Invalid email or password.");

    if (admin.status !== "active") {
      throw new ApiError(403, "Admin account is inactive.");
    }

    const token = generateToken({ id: admin._id, role: "admin" });

    sendResponse(res, 200, "Login successful.", {
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  })
);

authRoutes.get(
  "/me",
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res) => {
    sendResponse(res, 200, "Admin profile.", {
      admin: {
        id: req.admin._id,
        name: req.admin.name,
        email: req.admin.email,
        role: req.admin.role
      }
    });
  })
);
