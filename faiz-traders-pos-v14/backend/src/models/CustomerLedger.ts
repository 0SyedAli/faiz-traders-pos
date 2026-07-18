import mongoose, { Schema } from "mongoose";

const customerLedgerSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },

    type: {
      type: String,
      required: true,
      enum: ["sale", "payment", "return", "adjustment", "opening_balance"]
    },

    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    balanceAfter: { type: Number, required: true },

    referenceType: { type: String, default: null },
    referenceId: { type: Schema.Types.ObjectId, default: null },

    note: { type: String, trim: true }
  },
  { timestamps: true }
);

customerLedgerSchema.index({ customerId: 1, createdAt: -1 });

export const CustomerLedger = mongoose.model("CustomerLedger", customerLedgerSchema);
