import mongoose, { Schema } from "mongoose";

const salesReturnItemSchema = new Schema(
  {
    productVariantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    productNameSnapshot: { type: String, required: true },
    skuSnapshot: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true },
    condition: { type: String, default: "resellable", enum: ["resellable", "damaged"] }
  },
  { _id: false }
);

const salesReturnSchema = new Schema(
  {
    returnNo: { type: String, required: true, unique: true },
    saleId: { type: Schema.Types.ObjectId, ref: "Sale", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    items: { type: [salesReturnItemSchema], required: true },
    totalReturnAmount: { type: Number, required: true, min: 0 },
    refundMethod: { type: String, default: "adjust_credit", enum: ["adjust_credit", "cash", "no_refund"] },
    adjustInKhata: { type: Boolean, default: true },
    note: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null }
  },
  { timestamps: true }
);

salesReturnSchema.index({ returnNo: 1, createdAt: -1 });
salesReturnSchema.index({ saleId: 1, createdAt: -1 });

export const SalesReturn = mongoose.model("SalesReturn", salesReturnSchema);
