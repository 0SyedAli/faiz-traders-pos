import { Router } from "express";
import { z } from "zod";
import { Sale } from "../../models/Sale";
import { Customer } from "../../models/Customer";
import { CustomerLedger } from "../../models/CustomerLedger";
import { WarehouseStock } from "../../models/WarehouseStock";
import { StockMovement } from "../../models/StockMovement";
import { ProductVariant } from "../../models/ProductVariant";
import { Settings } from "../../models/Settings";
import { Category } from "../../models/Category";
import { requireAdmin, AuthRequest } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { ApiError } from "../../utils/apiError";
import { getCategorySearchAliases } from "../../utils/categoryConfig";

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

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getInvoicePrefix = async () => (await Settings.findOne())?.invoicePrefix || "INV";
const getNextInvoiceNo = async () => `${await getInvoicePrefix()}-${String((await Sale.countDocuments()) + 1).padStart(6, "0")}`;

const getWalkInCustomer = async () => {
  let customer = await Customer.findOne({ customerType: "walkin" });
  if (!customer) customer = await Customer.create({ name: "Walk-in Customer", customerType: "walkin", currentBalance: 0 });
  return customer;
};

const paymentStatus = (grandTotal: number, paidAmount: number) => {
  if (paidAmount <= 0) return "unpaid";
  if (paidAmount >= grandTotal) return "paid";
  return "partial";
};

const priceForSaleType = (variant: any, saleType: string) => {
  if (saleType === "wholesale" && Number(variant.wholesalePrice || 0) > 0) return Number(variant.wholesalePrice);
  if (saleType === "dealer" && Number(variant.distributorPrice || variant.dealerPrice || 0) > 0) return Number(variant.distributorPrice || variant.dealerPrice);
  if (saleType === "plumber" && Number(variant.wholesalePrice || 0) > 0) return Number(variant.wholesalePrice);
  return Number(variant.retailPrice || 0);
};

saleRoutes.get("/pos-categories", asyncHandler(async (_req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  sendResponse(res, 200, "POS categories.", categories);
}));

saleRoutes.get("/pos-products", asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const warehouseId = String(req.query.warehouseId || "").trim();
  const categoryId = String(req.query.categoryId || "").trim();
  const saleType = String(req.query.saleType || "retail").trim();

  if (!warehouseId) throw new ApiError(400, "warehouseId is required.");

  const variantFilter: any = { status: "active" };
  if (categoryId) variantFilter.categoryId = categoryId;

  if (q) {
    const tokens = q.split(/\s+/).filter(Boolean);
    variantFilter.$and = tokens.map((token) => ({ searchText: { $regex: escapeRegex(token), $options: "i" } }));
  }

  const variants = await ProductVariant.find(variantFilter)
    .populate("brandId", "name")
    .populate("categoryId", "name")
    .sort({ name: 1 })
    .limit(120);

  const stocks = await WarehouseStock.find({ warehouseId, productVariantId: { $in: variants.map((v) => v._id) } });
  const stockMap = new Map(stocks.map((stock) => [String(stock.productVariantId), Number(stock.quantity || 0)]));

  const rows = variants.map((variant: any) => {
    const categoryName = variant.categoryId?.name || "";
    return {
      _id: variant._id,
      name: variant.name,
      sku: variant.sku,
      brand: variant.brandId?.name === "No Brand" ? "" : variant.brandId?.name || "",
      category: categoryName,
      categoryAliases: getCategorySearchAliases(categoryName),
      size: variant.sizeLabel || "",
      gauge: variant.gauge || "",
      lengthFeet: variant.lengthFeet || 0,
      purchasePrice: variant.purchasePrice,
      retailPrice: variant.retailPrice,
      wholesalePrice: variant.wholesalePrice,
      distributorPrice: variant.distributorPrice || variant.dealerPrice,
      dealerPrice: variant.distributorPrice || variant.dealerPrice,
      salePrice: priceForSaleType(variant, saleType),
      stockQty: stockMap.get(String(variant._id)) || 0
    };
  });

  sendResponse(res, 200, "Fast POS product search.", rows);
}));

saleRoutes.get("/", asyncHandler(async (req, res) => {
  const customerId = String(req.query.customerId || "").trim();
  const from = req.query.from ? new Date(String(req.query.from)) : null;
  const to = req.query.to ? new Date(String(req.query.to)) : null;
  const filter: any = {};
  if (customerId) filter.customerId = customerId;
  if (from || to) {
    filter.createdAt = {};
    if (from) { from.setHours(0,0,0,0); filter.createdAt.$gte = from; }
    if (to) { to.setHours(23,59,59,999); filter.createdAt.$lte = to; }
  }
  const sales = await Sale.find(filter).populate("customerId", "name phone customerType currentBalance").populate("warehouseId", "name type").sort({ createdAt: -1 }).limit(200);
  sendResponse(res, 200, "Sales list.", sales);
}));

saleRoutes.post("/", asyncHandler(async (req: AuthRequest, res) => {
  const body = saleSchema.parse(req.body);
  const customer = body.customerId ? await Customer.findById(body.customerId) : await getWalkInCustomer();
  if (!customer) throw new ApiError(404, "Customer not found.");

  for (const item of body.items) {
    const variant = await ProductVariant.findById(item.productVariantId);
    if (!variant) throw new ApiError(404, "Product not found.");
    const stock = await WarehouseStock.findOne({ warehouseId: body.warehouseId, productVariantId: item.productVariantId });
    const available = Number(stock?.quantity || 0);
    if (available < item.quantity) throw new ApiError(400, `Not enough stock for ${variant.name}. Available: ${available}`);
  }

  const invoiceNo = await getNextInvoiceNo();
  const saleItems: any[] = [];
  let subtotal = 0;
  let totalProfit = 0;

  for (const item of body.items) {
    const variant: any = await ProductVariant.findById(item.productVariantId).populate("brandId", "name").populate("categoryId", "name");
    if (!variant) throw new ApiError(404, "Product not found.");

    const itemDiscount = Number(item.discount || 0);
    const lineTotal = Math.max(0, Number(item.quantity) * Number(item.salePrice) - itemDiscount);
    const purchaseCost = Number(item.quantity) * Number(variant.purchasePrice || 0);
    const profit = lineTotal - purchaseCost;
    subtotal += lineTotal;
    totalProfit += profit;

    saleItems.push({
      productVariantId: variant._id,
      productNameSnapshot: variant.name,
      skuSnapshot: variant.sku,
      brandSnapshot: variant.brandId?.name === "No Brand" ? "" : variant.brandId?.name || "",
      sizeSnapshot: variant.sizeLabel || "",
      gaugeSnapshot: variant.gauge || "",
      unitSnapshot: variant.lengthFeet ? "length" : "piece",
      quantity: item.quantity,
      lengthPerPiece: Number(variant.lengthFeet || 0),
      totalFeet: Number(variant.lengthFeet || 0) * Number(item.quantity || 0),
      purchasePriceSnapshot: Number(variant.purchasePrice || 0),
      salePrice: item.salePrice,
      discount: itemDiscount,
      total: lineTotal,
      profit
    });
  }

  const discountAmount = Number(body.discountAmount || 0);
  const grandTotal = Math.max(0, subtotal - discountAmount);
  const paidAmount = body.paymentMethod === "credit" ? 0 : Math.min(Number(body.paidAmount || 0), grandTotal);
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
    const stock = await WarehouseStock.findOne({ warehouseId: body.warehouseId, productVariantId: item.productVariantId });
    if (!stock) throw new ApiError(400, `Stock row missing for ${item.productNameSnapshot}.`);
    const previousStock = Number(stock.quantity || 0);
    const newStock = previousStock - Number(item.quantity);
    stock.quantity = newStock;
    await stock.save();
    await StockMovement.create({ warehouseId: body.warehouseId, productVariantId: item.productVariantId, type: "sale", quantity: -Number(item.quantity), previousStock, newStock, referenceType: "sale", referenceId: sale._id, note: `Sale ${invoiceNo}`, createdBy: req.admin?._id });
  }

  if (dueAmount > 0 || customer.customerType !== "walkin") {
    const oldBalance = Number(customer.currentBalance || 0);
    const newBalance = oldBalance + dueAmount;
    customer.currentBalance = newBalance;
    await customer.save();
    await CustomerLedger.create({ customerId: customer._id, type: "sale", debit: grandTotal, credit: paidAmount, balanceAfter: newBalance, referenceType: "sale", referenceId: sale._id, note: `Sale ${invoiceNo}` });
  }

  sendResponse(res, 201, "Sale created. Stock and customer ledger updated.", { sale, totalProfit });
}));

saleRoutes.get("/:id", asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id).populate("customerId", "name phone address customerType currentBalance").populate("warehouseId", "name type");
  if (!sale) throw new ApiError(404, "Sale not found.");
  sendResponse(res, 200, "Sale detail.", sale);
}));
