import mongoose, { Schema } from "mongoose";

const stockMovementSchema = new Schema(
  {
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    productVariantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true },

    type: {
      type: String,
      required: true,
      enum: [
        "purchase",
        "sale",
        "return",
        "damage",
        "adjustment",
        "transfer_in",
        "transfer_out",
        "opening_stock"
      ]
    },

    quantity: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },

    referenceType: { type: String, default: null },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    note: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null }
  },
  { timestamps: true }
);

stockMovementSchema.index({ warehouseId: 1, productVariantId: 1, createdAt: -1 });

export const StockMovement = mongoose.model("StockMovement", stockMovementSchema);
