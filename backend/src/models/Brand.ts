import mongoose, { Schema } from "mongoose";

const brandSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    status: { type: String, default: "active", enum: ["active", "inactive"] }
  },
  { timestamps: true }
);

export const Brand = mongoose.model("Brand", brandSchema);
