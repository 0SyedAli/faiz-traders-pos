import Dexie, { type EntityTable } from "dexie";
import type {
  LocalAuthRow,
  LocalCategory,
  LocalCustomer,
  LocalExpense,
  LocalMeta,
  LocalProduct,
  LocalSale,
  LocalSaleItem,
  LocalSetting,
  LocalWarehouse,
  SyncQueueRow,
} from "@/types/offline";

class MyStoreOfflineDatabase extends Dexie {
  products!: EntityTable<LocalProduct, "id">;
  categories!: EntityTable<LocalCategory, "id">;
  warehouses!: EntityTable<LocalWarehouse, "id">;
  customers!: EntityTable<LocalCustomer, "id">;
  settings!: EntityTable<LocalSetting, "key">;
  sales!: EntityTable<LocalSale, "id">;
  saleItems!: EntityTable<LocalSaleItem, "id">;
  expenses!: EntityTable<LocalExpense, "id">;
  syncQueue!: EntityTable<SyncQueueRow, "id">;
  auth!: EntityTable<LocalAuthRow, "email">;
  meta!: EntityTable<LocalMeta, "key">;

  constructor() {
    super("my-store-pos-offline");

    this.version(1).stores({
      products: "&id, serverId, warehouseId, categoryId, status, updatedAt, [warehouseId+categoryId]",
      categories: "&id, serverId, name, updatedAt",
      warehouses: "&id, serverId, type, updatedAt",
      customers: "&id, serverId, customerType, status, name, updatedAt",
      settings: "&key, updatedAt",
      sales: "&id, &clientUuid, invoiceNo, customerId, warehouseId, syncStatus, createdAt",
      saleItems: "&id, saleId, productVariantId",
      expenses: "&id, &clientUuid, syncStatus, expenseDate, createdAt",
      syncQueue: "&id, entityType, entityId, status, createdAt, nextRetryAt",
      auth: "&email, updatedAt",
      meta: "&key",
    });
  }
}

export const offlineDb = new MyStoreOfflineDatabase();

export const notifyOfflineDataUpdated = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("my-store-offline-data-updated"));
  }
};
