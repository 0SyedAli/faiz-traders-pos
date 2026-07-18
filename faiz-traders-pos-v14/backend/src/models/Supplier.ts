import mongoose, { Schema } from "mongoose";

const supplierSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },

    openingBalance: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },

    status: { type: String, default: "active", enum: ["active", "inactive"] }
  },
  { timestamps: true }
);

supplierSchema.index({ name: "text", phone: "text" });

export const Supplier = mongoose.model("Supplier", supplierSchema);
