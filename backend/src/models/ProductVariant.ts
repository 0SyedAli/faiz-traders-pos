import mongoose, { Schema } from "mongoose";

const productVariantSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },

    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    barcode: { type: String, trim: true, sparse: true, unique: true },

    brandId: { type: Schema.Types.ObjectId, ref: "Brand", required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    sizeId: { type: Schema.Types.ObjectId, ref: "Size", default: null },

    // Optional pipe/fitting thickness or gauge, example: 41, 64, Heavy, Medium.
    gauge: { type: String, default: "", trim: true },

    unitId: { type: Schema.Types.ObjectId, ref: "Unit", required: true },

    saleUnit: {
      type: String,
      default: "piece",
      enum: ["piece", "length", "feet", "meter", "box", "carton", "set", "bundle", "dozen"]
    },

    baseUnit: {
      type: String,
      default: "piece",
      enum: ["piece", "feet", "meter"]
    },

    lengthPerPiece: { type: Number, default: 0 },

    purchasePrice: { type: Number, required: true, min: 0 },
    retailPrice: { type: Number, required: true, min: 0 },
    wholesalePrice: { type: Number, default: 0, min: 0 },
    plumberPrice: { type: Number, default: 0, min: 0 },
    dealerPrice: { type: Number, default: 0, min: 0 },

    lowStockAlertQty: { type: Number, default: 5, min: 0 },
    allowDecimalQty: { type: Boolean, default: false },

    status: { type: String, default: "active", enum: ["active", "inactive"] }
  },
  { timestamps: true }
);

productVariantSchema.index({
  name: "text",
  sku: "text",
  barcode: "text",
  gauge: "text"
});

// Prevent same sellable item from being created again.
// Same product + brand/category + size + gauge + saleUnit is considered duplicate.
productVariantSchema.index(
  { productId: 1, brandId: 1, categoryId: 1, sizeId: 1, gauge: 1, saleUnit: 1 },
  { unique: true }
);

export const ProductVariant = mongoose.model("ProductVariant", productVariantSchema);
