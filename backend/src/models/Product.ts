import mongoose, { Schema } from "mongoose";

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    brandId: { type: Schema.Types.ObjectId, ref: "Brand", default: null },
    description: { type: String, trim: true },
    status: { type: String, default: "active", enum: ["active", "inactive"] }
  },
  { timestamps: true }
);

productSchema.index({ name: "text" });
productSchema.index({ name: 1, categoryId: 1, brandId: 1 }, { unique: true });

export const Product = mongoose.model("Product", productSchema);
