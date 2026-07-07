import { Router } from "express";
import { z } from "zod";
import { Sale } from "../../models/Sale";
import { Customer } from "../../models/Customer";
import { CustomerLedger } from "../../models/CustomerLedger";
import { WarehouseStock } from "../../models/WarehouseStock";
import { StockMovement } from "../../models/StockMovement";
import { ProductVariant } from "../../models/ProductVariant";
import { Settings } from "../../models/Settings";
import { requireAdmin, AuthRequest } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { ApiError } from "../../utils/apiError";

export const saleRoutes = Router();

saleRoutes.use(requireAdmin);

const saleItemSchema = z.object({
  productVariantId: z.string(),
  quantity: z.number().min(0.001),
  salePrice: z.number().min(0),
  discount: z.number().min(0).optional()
});

const saleSchema = z.object({
  customerId: z.string().optional(),
  warehouseId: z.string(),
  items: z.array(saleItemSchema).min(1),
  discountAmount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional(),
  paymentMethod: z.enum(["cash", "bank", "easypaisa", "jazzcash", "credit", "mixed"]).default("cash"),
  saleType: z.enum(["walkin", "retail", "wholesale", "plumber", "dealer"]).default("walkin"),
  note: z.string().optional()
});

const getInvoicePrefix = async () => {
  const settings = await Settings.findOne();
  return settings?.invoicePrefix || "INV";
};

const getNextInvoiceNo = async () => {
  const prefix = await getInvoicePrefix();
  const count = await Sale.countDocuments();
  return `${prefix}-${String(count + 1).padStart(6, "0")}`;
};

const getWalkInCustomer = async () => {
  let customer = await Customer.findOne({ customerType: "walkin" });
  if (!customer) {
    customer = await Customer.create({
      name: "Walk-in Customer",
      customerType: "walkin",
      currentBalance: 0
    });
  }
  return customer;
};

const paymentStatus = (grandTotal: number, paidAmount: number) => {
  if (paidAmount <= 0) return "unpaid";
  if (paidAmount >= grandTotal) return "paid";
  return "partial";
};

saleRoutes.get(
  "/pos-products",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const warehouseId = String(req.query.warehouseId || "").trim();

    if (!warehouseId) {
      throw new ApiError(400, "warehouseId is required.");
    }

    const variantFilter: any = { status: "active" };

    if (q) {
      variantFilter.$or = [
        { name: { $regex: q, $options: "i" } },
        { sku: { $regex: q, $options: "i" } },
        { barcode: { $regex: q, $options: "i" } }
      ];
    }

    const variants = await ProductVariant.find(variantFilter)
      .populate("brandId", "name")
      .populate("categoryId", "name")
      .populate("sizeId", "name")
      .populate("unitId", "name shortName")
      .sort({ name: 1 })
      .limit(80);

    const variantIds = variants.map((variant) => variant._id);

    const stocks = await WarehouseStock.find({
      warehouseId,
      productVariantId: { $in: variantIds }
    });

    const stockMap = new Map(stocks.map((stock) => [String(stock.productVariantId), stock.quantity]));

    const rows = variants.map((variant: any) => ({
      _id: variant._id,
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      brand: variant.brandId?.name || "",
      category: variant.categoryId?.name || "",
      size: variant.sizeId?.name || "",
      unit: variant.unitId?.shortName || variant.unitId?.name || "",
      saleUnit: variant.saleUnit,
      baseUnit: variant.baseUnit,
      lengthPerPiece: variant.lengthPerPiece,
      purchasePrice: variant.purchasePrice,
      retailPrice: variant.retailPrice,
      wholesalePrice: variant.wholesalePrice,
      plumberPrice: variant.plumberPrice,
      dealerPrice: variant.dealerPrice,
      allowDecimalQty: variant.allowDecimalQty,
      stockQty: stockMap.get(String(variant._id)) || 0
    }));

    sendResponse(res, 200, "POS product search.", rows);
  })
);

saleRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const customerId = String(req.query.customerId || "").trim();
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const filter: any = {};
    if (customerId) filter.customerId = customerId;

    if (from || to) {
      filter.createdAt = {};
      if (from) {
        from.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = from;
      }
      if (to) {
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    const sales = await Sale.find(filter)
      .populate("customerId", "name phone customerType currentBalance")
      .populate("warehouseId", "name type")
      .sort({ createdAt: -1 })
      .limit(200);

    sendResponse(res, 200, "Sales list.", sales);
  })
);

saleRoutes.post(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    const body = saleSchema.parse(req.body);

    const customer = body.customerId
      ? await Customer.findById(body.customerId)
      : await getWalkInCustomer();

    if (!customer) throw new ApiError(404, "Customer not found.");

    // First validate stock before any stock change.
    for (const item of body.items) {
      const variant = await ProductVariant.findById(item.productVariantId);
      if (!variant) throw new ApiError(404, "Product variant not found.");

      const stock = await WarehouseStock.findOne({
        warehouseId: body.warehouseId,
        productVariantId: item.productVariantId
      });

      const available = Number(stock?.quantity || 0);

      if (available < item.quantity) {
        throw new ApiError(
          400,
          `Not enough stock for ${variant.name}. Available: ${available}`
        );
      }
    }

    const invoiceNo = await getNextInvoiceNo();

    const saleItems: any[] = [];
    let subtotal = 0;
    let totalProfit = 0;

    for (const item of body.items) {
      const variant: any = await ProductVariant.findById(item.productVariantId)
        .populate("brandId", "name")
        .populate("sizeId", "name")
        .populate("unitId", "name shortName");

      if (!variant) throw new ApiError(404, "Product variant not found.");

      const itemDiscount = Number(item.discount || 0);
      const lineBeforeDiscount = Number(item.quantity) * Number(item.salePrice);
      const lineTotal = Math.max(0, lineBeforeDiscount - itemDiscount);
      const purchaseCost = Number(item.quantity) * Number(variant.purchasePrice || 0);
      const profit = lineTotal - purchaseCost;

      subtotal += lineTotal;
      totalProfit += profit;

      saleItems.push({
        productVariantId: variant._id,
        productNameSnapshot: variant.name,
        skuSnapshot: variant.sku,
        brandSnapshot: variant.brandId?.name || "",
        sizeSnapshot: variant.sizeId?.name || "",
        unitSnapshot: variant.unitId?.shortName || variant.unitId?.name || variant.saleUnit,
        quantity: item.quantity,
        lengthPerPiece: Number(variant.lengthPerPiece || 0),
        totalFeet:
          variant.saleUnit === "length"
            ? Number(item.quantity) * Number(variant.lengthPerPiece || 0)
            : variant.saleUnit === "feet"
              ? Number(item.quantity)
              : 0,
        purchasePriceSnapshot: Number(variant.purchasePrice || 0),
        salePrice: item.salePrice,
        discount: itemDiscount,
        total: lineTotal,
        profit
      });
    }

    const discountAmount = Number(body.discountAmount || 0);
    const grandTotal = Math.max(0, subtotal - discountAmount);
    const paidAmount = body.paymentMethod === "credit"
      ? 0
      : Math.min(Number(body.paidAmount || 0), grandTotal);
    const dueAmount = Math.max(0, grandTotal - paidAmount);

    const sale = await Sale.create({
      invoiceNo,
      customerId: customer._id,
      customerTypeSnapshot: customer.customerType,
      warehouseId: body.warehouseId,
      items: saleItems,
      subtotal,
      discountAmount,
      grandTotal,
      paidAmount,
      dueAmount,
      paymentMethod: body.paymentMethod,
      paymentStatus: paymentStatus(grandTotal, paidAmount),
      saleType: body.saleType,
      note: body.note,
      createdBy: req.admin?._id
    });

    for (const item of saleItems) {
      const stock = await WarehouseStock.findOne({
        warehouseId: body.warehouseId,
        productVariantId: item.productVariantId
      });

      if (!stock) throw new ApiError(400, `Stock row missing for ${item.productNameSnapshot}.`);

      const previousStock = Number(stock.quantity || 0);
      const newStock = previousStock - Number(item.quantity);

      stock.quantity = newStock;
      await stock.save();

      await StockMovement.create({
        warehouseId: body.warehouseId,
        productVariantId: item.productVariantId,
        type: "sale",
        quantity: -Number(item.quantity),
        previousStock,
        newStock,
        referenceType: "sale",
        referenceId: sale._id,
        note: `Sale ${invoiceNo}`,
        createdBy: req.admin?._id
      });
    }

    if (dueAmount > 0 || customer.customerType !== "walkin") {
      const oldBalance = Number(customer.currentBalance || 0);
      const newBalance = oldBalance + dueAmount;

      customer.currentBalance = newBalance;
      await customer.save();

      await CustomerLedger.create({
        customerId: customer._id,
        type: "sale",
        debit: grandTotal,
        credit: paidAmount,
        balanceAfter: newBalance,
        referenceType: "sale",
        referenceId: sale._id,
        note: `Sale ${invoiceNo}`
      });
    }

    sendResponse(res, 201, "Sale created. Stock and customer ledger updated.", {
      sale,
      totalProfit
    });
  })
);

saleRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const sale = await Sale.findById(req.params.id)
      .populate("customerId", "name phone address customerType currentBalance")
      .populate("warehouseId", "name type");

    if (!sale) throw new ApiError(404, "Sale not found.");

    sendResponse(res, 200, "Sale detail.", sale);
  })
);
