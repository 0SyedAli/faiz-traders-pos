import mongoose, { Document, Schema } from "mongoose";

export interface IAdminUser extends Document {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: "admin";
  status: "active" | "inactive";
}

const adminUserSchema = new Schema<IAdminUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, default: "admin", enum: ["admin"] },
    status: { type: String, default: "active", enum: ["active", "inactive"] }
  },
  { timestamps: true }
);

export const AdminUser = mongoose.model<IAdminUser>("AdminUser", adminUserSchema);
