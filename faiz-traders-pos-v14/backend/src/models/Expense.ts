import mongoose, { Schema } from "mongoose";

const expenseSchema = new Schema(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: "ExpenseCategory", required: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      default: "cash",
      enum: ["cash", "bank", "easypaisa", "jazzcash", "cheque", "other"]
    },
    expenseDate: { type: Date, default: Date.now },
    note: { type: String, trim: true }
  },
  { timestamps: true }
);

expenseSchema.index({ expenseDate: -1 });

export const Expense = mongoose.model("Expense", expenseSchema);
