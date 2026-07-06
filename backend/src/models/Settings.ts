import mongoose, { Schema } from "mongoose";

const settingsSchema = new Schema(
  {
    businessName: { type: String, default: "My Sanitary Store" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    currency: { type: String, default: "PKR" },

    invoicePrefix: { type: String, default: "INV" },
    purchasePrefix: { type: String, default: "PUR" },
    quotationPrefix: { type: String, default: "QTN" },

    taxEnabled: { type: Boolean, default: false },
    defaultTaxPercentage: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const Settings = mongoose.model("Settings", settingsSchema);
