import { connectDB } from "./config/db";
import { env } from "./config/env";
import { Brand } from "./models/Brand";
import { Category } from "./models/Category";
import { Unit } from "./models/Unit";
import { Size } from "./models/Size";
import { Warehouse } from "./models/Warehouse";
import { Customer } from "./models/Customer";
import { ExpenseCategory } from "./models/ExpenseCategory";
import { Settings } from "./models/Settings";
import mongoose from "mongoose";
import { resetDefaultAdmin } from "./services/adminBootstrap";

const upsertByName = async (Model: any, docs: any[]) => {
  for (const doc of docs) {
    await Model.updateOne({ name: doc.name }, { $setOnInsert: doc }, { upsert: true });
  }
};

const seed = async () => {
  await connectDB();

  const adminResult = await resetDefaultAdmin();
  console.log(adminResult.created ? "Admin user created." : "Admin credentials refreshed.");
  console.log(`Admin email: ${adminResult.email}`);

  await upsertByName(Brand, [
    { name: "Steelex" },
    { name: "Pak Arab" },
    { name: "Aerofit" },
    { name: "Other" }
  ]);

  await upsertByName(Category, [
    { name: "GI Fitting" },
    { name: "UPVC Fitting" },
    { name: "CPVC Fitting" },
    { name: "PPR Fitting" },
    { name: "GI Pipe" },
    { name: "UPVC Pipe" },
    { name: "CPVC Pipe" },
    { name: "PPR Pipe" },
    { name: "Muslim Shower" },
    { name: "Basin Tap" },
    { name: "Basin Mixer" },
    { name: "Wall Shower Set" },
    { name: "Commode" },
    { name: "Valves" },
    { name: "Accessories" }
  ]);

  await upsertByName(Unit, [
    { name: "Piece", shortName: "pcs", allowDecimal: false },
    { name: "Box", shortName: "box", allowDecimal: false },
    { name: "Dozen", shortName: "doz", allowDecimal: false },
    { name: "Feet", shortName: "ft", allowDecimal: true },
    { name: "Meter", shortName: "m", allowDecimal: true },
    { name: "Bundle", shortName: "bdl", allowDecimal: false },
    { name: "Carton", shortName: "ctn", allowDecimal: false },
    { name: "Set", shortName: "set", allowDecimal: false },
    { name: "Length", shortName: "len", allowDecimal: false }
  ]);

  await upsertByName(Size, [
    { name: "1/2", sortOrder: 1 },
    { name: "3/4", sortOrder: 2 },
    { name: "1", sortOrder: 3 },
    { name: "1-1/4", sortOrder: 4 },
    { name: "1-1/2", sortOrder: 5 },
    { name: "2", sortOrder: 6 },
    { name: "3", sortOrder: 7 },
    { name: "4", sortOrder: 8 },
    { name: "5", sortOrder: 9 },
    { name: "6", sortOrder: 10 },
    { name: "20mm", sortOrder: 11 },
    { name: "25mm", sortOrder: 12 },
    { name: "32mm", sortOrder: 13 },
    { name: "40mm", sortOrder: 14 },
    { name: "50mm", sortOrder: 15 },
    { name: "63mm", sortOrder: 16 },
    { name: "75mm", sortOrder: 17 },
    { name: "90mm", sortOrder: 18 }
  ]);

  await upsertByName(Warehouse, [
    { name: "Main Shop", type: "shop" },
    { name: "Godown 1", type: "godown" }
  ]);

  const walkinExists = await Customer.findOne({ customerType: "walkin" });
  if (!walkinExists) {
    await Customer.create({
      name: "Walk-in Customer",
      customerType: "walkin",
      currentBalance: 0
    });
  }

  await upsertByName(ExpenseCategory, [
    { name: "Rent" },
    { name: "Electricity" },
    { name: "Salary" },
    { name: "Transport" },
    { name: "Loading / Unloading" },
    { name: "Repairs" },
    { name: "Tea / Food" },
    { name: "Internet" },
    { name: "Miscellaneous" }
  ]);

  const settingsExists = await Settings.findOne();
  if (!settingsExists) {
    await Settings.create({
      businessName: "My Sanitary Store",
      currency: "PKR"
    });
  }

  console.log("Seed completed.");
  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
