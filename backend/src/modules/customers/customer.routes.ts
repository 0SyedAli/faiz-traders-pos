import { Router } from "express";
import { z } from "zod";
import { Customer } from "../../models/Customer";
import { CustomerLedger } from "../../models/CustomerLedger";
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
  note: z.string().optional()
});

customerRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const type = String(req.query.type || "").trim();

    const filter: any = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } }
      ];
    }
    if (type) filter.customerType = type;

    const customers = await Customer.find(filter).sort({ createdAt: -1 });
    sendResponse(res, 200, "Customer list.", customers);
  })
);

customerRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = customerSchema.parse(req.body);
    const customer = await Customer.create({
      ...body,
      currentBalance: body.openingBalance || 0
    });

    if (body.openingBalance && body.openingBalance > 0) {
      await CustomerLedger.create({
        customerId: customer._id,
        type: "opening_balance",
        debit: body.openingBalance,
        credit: 0,
        balanceAfter: body.openingBalance,
        note: "Opening balance"
      });
    }

    sendResponse(res, 201, "Customer created.", customer);
  })
);

customerRoutes.get(
  "/:id/ledger",
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) throw new ApiError(404, "Customer not found.");

    const ledger = await CustomerLedger.find({ customerId: req.params.id }).sort({ createdAt: -1 });

    sendResponse(res, 200, "Customer ledger.", { customer, ledger });
  })
);

customerRoutes.post(
  "/:id/receive-payment",
  asyncHandler(async (req, res) => {
    const body = paymentSchema.parse(req.body);

    const customer = await Customer.findById(req.params.id);
    if (!customer) throw new ApiError(404, "Customer not found.");

    const newBalance = Math.max(0, customer.currentBalance - body.amount);

    customer.currentBalance = newBalance;
    await customer.save();

    const ledger = await CustomerLedger.create({
      customerId: customer._id,
      type: "payment",
      debit: 0,
      credit: body.amount,
      balanceAfter: newBalance,
      referenceType: "customer_payment",
      note: body.note || "Customer payment received"
    });

    sendResponse(res, 200, "Customer payment received.", { customer, ledger });
  })
);
