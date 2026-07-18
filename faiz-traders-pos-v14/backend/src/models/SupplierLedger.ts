import mongoose, { Schema } from "mongoose";

const supplierLedgerSchema = new Schema(
  {
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },

    type: {
      type: String,
      required: true,
      enum: ["purchase", "payment", "adjustment", "opening_balance"]
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

supplierLedgerSchema.index({ supplierId: 1, createdAt: -1 });

export const SupplierLedger = mongoose.model("SupplierLedger", supplierLedgerSchema);
