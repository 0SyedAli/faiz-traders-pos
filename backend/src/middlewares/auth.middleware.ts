import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AdminUser } from "../models/AdminUser";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";

export interface AuthRequest extends Request {
  admin?: any;
}

export const requireAdmin = asyncHandler(
  async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "Unauthorized. Token missing.");
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      throw new ApiError(401, "Unauthorized. Token missing.");
    }

    let decoded: { id: string };

    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
    } catch {
      throw new ApiError(401, "Session expired or token is invalid. Please login again.");
    }

    if (!decoded.id) {
      throw new ApiError(401, "Session is invalid. Please login again.");
    }

    const admin = await AdminUser.findById(decoded.id);
    if (!admin || admin.status !== "active") {
      throw new ApiError(401, "Unauthorized. Admin not found.");
    }

    req.admin = admin;
    next();
  }
);
