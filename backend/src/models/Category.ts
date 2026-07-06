import mongoose, { Schema } from "mongoose";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    status: { type: String, default: "active", enum: ["active", "inactive"] }
  },
  { timestamps: true }
);

categorySchema.index({ name: 1, parentId: 1 }, { unique: true });

export const Category = mongoose.model("Category", categorySchema);
