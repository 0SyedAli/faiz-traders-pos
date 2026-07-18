import { app } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { ensureDefaultAdmin } from "./services/adminBootstrap";

const startServer = async () => {
  await connectDB();

  const adminResult = await ensureDefaultAdmin();
  if (adminResult.created) {
    console.log(`Default admin created: ${adminResult.email}`);
  } else if (adminResult.updated) {
    console.log(`Default admin credentials refreshed: ${adminResult.email}`);
  }

  app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Server failed:", error);
  process.exit(1);
});
