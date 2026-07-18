import mongoose, { Schema } from "mongoose";

const unitSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    shortName: { type: String, required: true, unique: true, trim: true },
    allowDecimal: { type: Boolean, default: false },
    status: { type: String, default: "active", enum: ["active", "inactive"] }
  },
  { timestamps: true }
);

export const Unit = mongoose.model("Unit", unitSchema);
