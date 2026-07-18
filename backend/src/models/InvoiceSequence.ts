import mongoose, { Schema } from "mongoose";

const invoiceSequenceSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const InvoiceSequence = mongoose.model("InvoiceSequence", invoiceSequenceSchema);
