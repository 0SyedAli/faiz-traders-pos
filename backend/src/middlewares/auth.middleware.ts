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

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };

    const admin = await AdminUser.findById(decoded.id);
    if (!admin || admin.status !== "active") {
      throw new ApiError(401, "Unauthorized. Admin not found.");
    }

    req.admin = admin;
    next();
  }
);
