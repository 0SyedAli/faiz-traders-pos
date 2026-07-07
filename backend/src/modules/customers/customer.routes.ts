import { Router } from "express";
import { z } from "zod";
import { Customer } from "../../models/Customer";
import { CustomerLedger } from "../../models/CustomerLedger";
import { Sale } from "../../models/Sale";
import { requireAdmin } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { ApiError } from "../../utils/apiError";

export const customerRoutes = Router();

customerRoutes.use(requireAdmin);

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  customerType: z.enum(["walkin", "regular", "plumber", "contractor", "dealer"]).optional(),
  openingBalance: z.number().min(0).optional(),
  status: z.enum(["active", "inactive"]).optional()
});

const paymentSchema = z.object({
  amount: z.number().min(1),
  paymentMethod: z.enum(["cash", "bank", "easypaisa", "jazzcash", "cheque", "other"]).default("cash"),
  note: z.string().optional()
});

const adjustmentSchema = z.object({
  adjustmentType: z.enum(["debit", "credit"]),
  amount: z.number().min(1),
  note: z.string().min(1)
});

customerRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const type = String(req.query.type || "").trim();
    const status = String(req.query.status || "").trim();

    const filter: any = {};

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } }
      ];
    }

    if (type) filter.customerType = type;
    if (status) filter.status = status;

    const customers = await Customer.find(filter).sort({ currentBalance: -1, createdAt: -1 });
    sendResponse(res, 200, "Customer list.", customers);
  })
);

customerRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = customerSchema.parse(req.body);
    const openingBalance = Number(body.openingBalance || 0);

    const customer = await Customer.create({
      ...body,
      customerType: body.customerType || "regular",
      openingBalance,
      currentBalance: openingBalance
    });

    if (openingBalance > 0) {
      await CustomerLedger.create({
        customerId: customer._id,
        type: "opening_balance",
        debit: openingBalance,
        credit: 0,
        balanceAfter: openingBalance,
        referenceType: "opening_balance",
        note: "Opening balance"
      });
    }

    sendResponse(res, 201, "Customer created.", customer);
  })
);

customerRoutes.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const [totalAgg, plumberAgg, contractorAgg, dealerAgg, creditAgg] = await Promise.all([
      Customer.countDocuments(),
      Customer.countDocuments({ customerType: "plumber" }),
      Customer.countDocuments({ customerType: "contractor" }),
      Customer.countDocuments({ customerType: "dealer" }),
      Customer.aggregate([{ $group: { _id: null, total: { $sum: "$currentBalance" } } }])
    ]);

    sendResponse(res, 200, "Customer summary.", {
      totalCustomers: totalAgg,
      plumbers: plumberAgg,
      contractors: contractorAgg,
      dealers: dealerAgg,
      totalCredit: creditAgg[0]?.total || 0
    });
  })
);

customerRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) throw new ApiError(404, "Customer not found.");

    sendResponse(res, 200, "Customer detail.", customer);
  })
);

customerRoutes.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = customerSchema.partial().parse(req.body);

    // Opening balance is not editable after creation because ledger should remain accurate.
    delete (body as any).openingBalance;

    const customer = await Customer.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true
    });

    if (!customer) throw new ApiError(404, "Customer not found.");

    sendResponse(res, 200, "Customer updated.", customer);
  })
);

customerRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) throw new ApiError(404, "Customer not found.");

    if (customer.customerType === "walkin") {
      throw new ApiError(400, "Walk-in customer cannot be deleted.");
    }

    if (Number(customer.currentBalance || 0) > 0) {
      throw new ApiError(400, "Cannot delete customer with remaining balance.");
    }

    const salesCount = await Sale.countDocuments({ customerId: customer._id });
    if (salesCount > 0) {
      throw new ApiError(400, "Cannot delete customer with sale history. Set inactive instead.");
    }

    await CustomerLedger.deleteMany({ customerId: customer._id });
    await Customer.findByIdAndDelete(customer._id);

    sendResponse(res, 200, "Customer deleted.", customer);
  })
);

customerRoutes.get(
  "/:id/ledger",
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) throw new ApiError(404, "Customer not found.");

    const ledger = await CustomerLedger.find({ customerId: customer._id }).sort({ createdAt: -1 });

    sendResponse(res, 200, "Customer ledger.", { customer, ledger });
  })
);

customerRoutes.post(
  "/:id/receive-payment",
  asyncHandler(async (req, res) => {
    const body = paymentSchema.parse(req.body);

    const customer = await Customer.findById(req.params.id);
    if (!customer) throw new ApiError(404, "Customer not found.");

    const amount = Number(body.amount);
    const newBalance = Math.max(0, Number(customer.currentBalance || 0) - amount);

    customer.currentBalance = newBalance;
    await customer.save();

    const ledger = await CustomerLedger.create({
      customerId: customer._id,
      type: "payment",
      debit: 0,
      credit: amount,
      balanceAfter: newBalance,
      referenceType: "customer_payment",
      note: body.note || `Payment received by ${body.paymentMethod}`
    });

    sendResponse(res, 200, "Customer payment received.", { customer, ledger });
  })
);

customerRoutes.post(
  "/:id/adjustment",
  asyncHandler(async (req, res) => {
    const body = adjustmentSchema.parse(req.body);

    const customer = await Customer.findById(req.params.id);
    if (!customer) throw new ApiError(404, "Customer not found.");

    const amount = Number(body.amount);
    const oldBalance = Number(customer.currentBalance || 0);

    const newBalance =
      body.adjustmentType === "debit"
        ? oldBalance + amount
        : Math.max(0, oldBalance - amount);

    customer.currentBalance = newBalance;
    await customer.save();

    const ledger = await CustomerLedger.create({
      customerId: customer._id,
      type: "adjustment",
      debit: body.adjustmentType === "debit" ? amount : 0,
      credit: body.adjustmentType === "credit" ? amount : 0,
      balanceAfter: newBalance,
      referenceType: "manual_adjustment",
      note: body.note
    });

    sendResponse(res, 200, "Customer balance adjusted.", { customer, ledger });
  })
);
