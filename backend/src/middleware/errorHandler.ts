import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import logger from "./logger";

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({ err, path: req.path }, "Request error");

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  const status = err.statusCode ?? 500;
  res.status(status).json({
    error: err.message ?? "Internal server error",
  });
}
