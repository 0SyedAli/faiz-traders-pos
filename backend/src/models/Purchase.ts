import mongoose, { Schema } from "mongoose";

const purchaseItemSchema = new Schema(
  {
    productVariantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    productNameSnapshot: { type: String, required: true },
    skuSnapshot: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.001 },
    purchasePrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true }
  },
  { _id: false }
);

const purchaseSchema = new Schema(
  {
    purchaseNo: { type: String, required: true, unique: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },

    items: { type: [purchaseItemSchema], required: true },

    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },

    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },

    paymentStatus: {
      type: String,
      default: "unpaid",
      enum: ["paid", "partial", "unpaid"]
    },

    note: { type: String, trim: true }
  },
  { timestamps: true }
);

purchaseSchema.index({ purchaseNo: 1, createdAt: -1 });

export const Purchase = mongoose.model("Purchase", purchaseSchema);
