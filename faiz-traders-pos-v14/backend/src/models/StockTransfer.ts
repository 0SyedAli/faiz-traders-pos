import mongoose, { Schema } from "mongoose";

const stockTransferItemSchema = new Schema(
  {
    productVariantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    productNameSnapshot: { type: String, required: true },
    skuSnapshot: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.001 }
  },
  { _id: false }
);

const stockTransferSchema = new Schema(
  {
    transferNo: { type: String, required: true, unique: true },

    fromWarehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    toWarehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },

    items: { type: [stockTransferItemSchema], required: true },

    note: { type: String, trim: true },
    status: {
      type: String,
      default: "completed",
      enum: ["completed", "cancelled"]
    },

    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null }
  },
  { timestamps: true }
);

stockTransferSchema.index({ transferNo: 1, createdAt: -1 });

export const StockTransfer = mongoose.model("StockTransfer", stockTransferSchema);
