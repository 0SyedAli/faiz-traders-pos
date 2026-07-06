import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { authRoutes } from "./modules/auth/auth.routes";
import { masterRoutes } from "./modules/master/master.routes";
import { productRoutes } from "./modules/products/product.routes";
import { inventoryRoutes } from "./modules/inventory/inventory.routes";
import { customerRoutes } from "./modules/customers/customer.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { expenseRoutes } from "./modules/expenses/expense.routes";
import { errorHandler, notFound } from "./middlewares/error.middleware";

export const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ success: true, message: "My Store POS ERP API is running." });
});

app.use("/api/auth", authRoutes);
app.use("/api/master", masterRoutes);
app.use("/api/products", productRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/expenses", expenseRoutes);

app.use(notFound);
app.use(errorHandler);
