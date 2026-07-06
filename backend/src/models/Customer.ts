import mongoose, { Schema } from "mongoose";

const customerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },

    customerType: {
      type: String,
      default: "walkin",
      enum: ["walkin", "regular", "plumber", "contractor", "dealer"]
    },

    openingBalance: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },

    status: { type: String, default: "active", enum: ["active", "inactive"] }
  },
  { timestamps: true }
);

customerSchema.index({ name: "text", phone: "text" });

export const Customer = mongoose.model("Customer", customerSchema);
