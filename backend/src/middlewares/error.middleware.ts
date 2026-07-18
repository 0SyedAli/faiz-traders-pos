import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import { env } from "../config/env";

export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err instanceof ApiError ? err.statusCode : 500;

  if (statusCode >= 500) {
    console.error(`[${req.method}] ${req.originalUrl}`, err);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || "Server error",
    ...(env.NODE_ENV !== "production" && statusCode >= 500 ? { stack: err.stack } : {})
  });
};
