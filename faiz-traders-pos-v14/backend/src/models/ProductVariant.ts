import mongoose, { Schema } from "mongoose";

const productVariantSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },

    // A sellable item name, example: Iron Elbow, Master UPVC Pipe.
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },

    // Barcode is intentionally not used by this shop, kept only for old data compatibility.
    barcode: { type: String, trim: true, sparse: true },

    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    brandId: { type: Schema.Types.ObjectId, ref: "Brand", default: null },

    // Old sizeId remains optional for compatibility; new flow uses sizeLabel directly.
    sizeId: { type: Schema.Types.ObjectId, ref: "Size", default: null },
    sizeLabel: { type: String, default: "", trim: true },

    // Pipe/fitting thickness. Examples: 41, 64, SCH40, Heavy.
    gauge: { type: String, default: "", trim: true },

    // Pipe fixed length in feet. GI/UPVC/CPVC = 20, PPR = 10.
    lengthFeet: { type: Number, default: 0, min: 0 },

    // Units are ignored in UI. These fields remain only so old sales/purchase code stays compatible.
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", default: null },
    saleUnit: { type: String, default: "piece", enum: ["piece", "length", "feet", "meter", "box", "carton", "set", "bundle", "dozen"] },
    baseUnit: { type: String, default: "piece", enum: ["piece", "feet", "meter"] },
    lengthPerPiece: { type: Number, default: 0 },

    purchasePrice: { type: Number, required: true, min: 0 },
    retailPrice: { type: Number, required: true, min: 0 },
    wholesalePrice: { type: Number, default: 0, min: 0 },
    distributorPrice: { type: Number, default: 0, min: 0 },

    // Old pricing fields kept for compatibility with existing POS customer types.
    plumberPrice: { type: Number, default: 0, min: 0 },
    dealerPrice: { type: Number, default: 0, min: 0 },

    minimumStock: { type: Number, default: 5, min: 0 },
    lowStockAlertQty: { type: Number, default: 5, min: 0 },
    allowDecimalQty: { type: Boolean, default: false },

    searchText: { type: String, default: "", trim: true },
    duplicateKey: { type: String, required: true, trim: true },

    description: { type: String, default: "", trim: true },
    status: { type: String, default: "active", enum: ["active", "inactive"] }
  },
  { timestamps: true }
);

productVariantSchema.index({ searchText: "text", name: "text", sku: "text", sizeLabel: "text", gauge: "text" });
productVariantSchema.index({ duplicateKey: 1 });
productVariantSchema.index({ categoryId: 1, name: 1, sizeLabel: 1, gauge: 1, brandId: 1 });

export const ProductVariant = mongoose.model("ProductVariant", productVariantSchema);
