import mongoose, { Schema } from "mongoose";

const sizeSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    status: { type: String, default: "active", enum: ["active", "inactive"] }
  },
  { timestamps: true }
);

export const Size = mongoose.model("Size", sizeSchema);
