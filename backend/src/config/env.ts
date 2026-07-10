import dotenv from "dotenv";

dotenv.config();

const required = (key: string, fallback?: string) => {
  const value = process.env[key] || fallback;
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 5001),
  MONGODB_URI: required("MONGODB_URI", "mongodb://127.0.0.1:27017/faiz-traders-pos"),
  JWT_SECRET: required("JWT_SECRET", "change_this_secret_key"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  ADMIN_SETUP_KEY: process.env.ADMIN_SETUP_KEY || "my-store-setup-key",

  ADMIN_NAME: process.env.ADMIN_NAME || "Owner",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@mystore.com",
  ADMIN_PHONE: process.env.ADMIN_PHONE || "03000000000",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin123456"
};
