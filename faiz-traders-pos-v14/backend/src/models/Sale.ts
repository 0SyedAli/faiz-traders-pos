import mongoose, { Schema } from "mongoose";

const saleItemSchema = new Schema(
  {
    productVariantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true },

    productNameSnapshot: { type: String, required: true },
    skuSnapshot: { type: String, required: true },
    brandSnapshot: { type: String, default: "" },
    sizeSnapshot: { type: String, default: "" },
    unitSnapshot: { type: String, default: "" },

    quantity: { type: Number, required: true, min: 0.001 },
    lengthPerPiece: { type: Number, default: 0 },
    totalFeet: { type: Number, default: 0 },

    purchasePriceSnapshot: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    profit: { type: Number, required: true }
  },
  { _id: false }
);

const saleSchema = new Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    customerTypeSnapshot: { type: String, default: "walkin" },

    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },

    items: { type: [saleItemSchema], required: true },

    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },

    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },

    paymentMethod: {
      type: String,
      default: "cash",
      enum: ["cash", "bank", "easypaisa", "jazzcash", "credit", "mixed"]
    },
    paymentStatus: {
      type: String,
      default: "paid",
      enum: ["paid", "partial", "unpaid"]
    },

    saleType: {
      type: String,
      default: "walkin",
      enum: ["walkin", "retail", "wholesale", "plumber", "dealer"]
    },

    note: { type: String, trim: true }
  },
  { timestamps: true }
);

saleSchema.index({ invoiceNo: 1, createdAt: -1 });

export const Sale = mongoose.model("Sale", saleSchema);
