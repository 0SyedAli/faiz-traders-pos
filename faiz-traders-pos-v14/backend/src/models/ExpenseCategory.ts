import mongoose, { Schema } from "mongoose";

const expenseCategorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    status: { type: String, default: "active", enum: ["active", "inactive"] }
  },
  { timestamps: true }
);

export const ExpenseCategory = mongoose.model("ExpenseCategory", expenseCategorySchema);
