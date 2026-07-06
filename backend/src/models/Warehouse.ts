import mongoose, { Schema } from "mongoose";

const warehouseSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    type: { type: String, default: "shop", enum: ["shop", "godown"] },
    address: { type: String, trim: true },
    status: { type: String, default: "active", enum: ["active", "inactive"] }
  },
  { timestamps: true }
);

export const Warehouse = mongoose.model("Warehouse", warehouseSchema);
