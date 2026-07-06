import mongoose, { Schema } from "mongoose";

const warehouseStockSchema = new Schema(
  {
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    productVariantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    quantity: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

warehouseStockSchema.index({ warehouseId: 1, productVariantId: 1 }, { unique: true });

export const WarehouseStock = mongoose.model("WarehouseStock", warehouseStockSchema);
