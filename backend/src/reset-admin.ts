import mongoose from "mongoose";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { resetDefaultAdmin } from "./services/adminBootstrap";

const run = async () => {
  await connectDB();
  const result = await resetDefaultAdmin();

  console.log(result.created ? "Default admin created." : "Default admin credentials reset.");
  console.log(`Email: ${result.email}`);
  console.log(`Password: ${env.ADMIN_PASSWORD}`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Admin reset failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
