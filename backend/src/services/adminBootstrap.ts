import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { AdminUser } from "../models/AdminUser";

export type DefaultAdminResult = {
  created: boolean;
  updated: boolean;
  email: string;
};

const normalizedAdminEmail = () => env.ADMIN_EMAIL.trim().toLowerCase();

export const ensureDefaultAdmin = async (): Promise<DefaultAdminResult> => {
  const email = normalizedAdminEmail();
  const existing = await AdminUser.findOne({ email }).select("+password");

  if (existing) {
    let updated = false;

    if (existing.status !== "active") {
      existing.status = "active";
      updated = true;
    }

    if (env.NODE_ENV !== "production") {
      const passwordMatches = await bcrypt.compare(env.ADMIN_PASSWORD, existing.password);
      if (!passwordMatches) {
        existing.password = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
        updated = true;
      }
    }

    if (updated) {
      existing.name = env.ADMIN_NAME.trim();
      existing.phone = env.ADMIN_PHONE.trim();
      existing.role = "admin";
      await existing.save();
    }

    return { created: false, updated, email };
  }

  await AdminUser.create({
    name: env.ADMIN_NAME.trim(),
    email,
    phone: env.ADMIN_PHONE.trim(),
    password: await bcrypt.hash(env.ADMIN_PASSWORD, 10),
    role: "admin",
    status: "active"
  });

  return { created: true, updated: false, email };
};

export const resetDefaultAdmin = async (): Promise<DefaultAdminResult> => {
  const email = normalizedAdminEmail();
  const hashedPassword = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
  const existing = await AdminUser.findOne({ email }).select("+password");

  if (!existing) {
    await AdminUser.create({
      name: env.ADMIN_NAME.trim(),
      email,
      phone: env.ADMIN_PHONE.trim(),
      password: hashedPassword,
      role: "admin",
      status: "active"
    });

    return { created: true, updated: false, email };
  }

  existing.name = env.ADMIN_NAME.trim();
  existing.phone = env.ADMIN_PHONE.trim();
  existing.password = hashedPassword;
  existing.role = "admin";
  existing.status = "active";
  await existing.save();

  return { created: false, updated: true, email };
};
