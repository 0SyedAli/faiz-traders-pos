import { api } from "@/lib/api";
import { offlineDb, notifyOfflineDataUpdated } from "@/lib/offline-db";
import { productSearchText } from "@/lib/local-search";
import type { LocalCategory, LocalCustomer, LocalProduct, LocalWarehouse, SyncQueueRow } from "@/types/offline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";
const SERVER_URL = API_URL.replace(/\/api\/?$/, "");
const HOUR = 60 * 60 * 1000;

export type BootstrapPayload = {
  serverTime: string;
  warehouses: Array<{ _id: string; name: string; type: string; updatedAt?: string }>;
  categories: Array<{ _id: string; name: string; updatedAt?: string }>;
  customers: Array<{
    _id: string;
    name: string;
    phone?: string;
    customerType: string;
    currentBalance: number;
    status: string;
    updatedAt?: string;
  }>;
  settings: Record<string, unknown> | null;
  products: Array<{
    _id: string;
    warehouseId: string;
    categoryId: string;
    name: string;
    sku: string;
    brand?: string;
    category?: string;
    size?: string;
    gauge?: string;
    lengthFeet?: number;
    purchasePrice: number;
    retailPrice: number;
    wholesalePrice?: number;
    distributorPrice?: number;
    dealerPrice?: number;
    stockQty: number;
    status: string;
    updatedAt?: string;
  }>;
};

export const serverIsReachable = async () => {
  try {
    const response = await fetch(`${SERVER_URL}/health`, { cache: "no-store", signal: AbortSignal.timeout(4_000) });
    return response.ok;
  } catch {
    return false;
  }
};

export const getPendingSyncCount = () => offlineDb.syncQueue.where("status").anyOf("pending", "failed").count();

export const applyBootstrap = async (payload: BootstrapPayload) => {
  const now = new Date().toISOString();

  const warehouses: LocalWarehouse[] = payload.warehouses.map((row) => ({
    id: row._id,
    serverId: row._id,
    name: row.name,
    type: row.type,
    updatedAt: row.updatedAt || now,
  }));

  const categories: LocalCategory[] = payload.categories.map((row) => ({
    id: row._id,
    serverId: row._id,
    name: row.name,
    updatedAt: row.updatedAt || now,
  }));

  const customers: LocalCustomer[] = payload.customers.map((row) => ({
    id: row._id,
    serverId: row._id,
    name: row.name,
    phone: row.phone,
    customerType: row.customerType,
    currentBalance: Number(row.currentBalance || 0),
    status: row.status || "active",
    updatedAt: row.updatedAt || now,
  }));

  const products: LocalProduct[] = payload.products.map((row) => {
    const product: LocalProduct = {
      id: `${row.warehouseId}:${row._id}`,
      serverId: row._id,
      warehouseId: row.warehouseId,
      categoryId: row.categoryId,
      name: row.name,
      sku: row.sku,
      brand: row.brand || "",
      category: row.category || "",
      size: row.size || "",
      gauge: row.gauge || "",
      lengthFeet: Number(row.lengthFeet || 0),
      purchasePrice: Number(row.purchasePrice || 0),
      retailPrice: Number(row.retailPrice || 0),
      wholesalePrice: Number(row.wholesalePrice || 0),
      distributorPrice: Number(row.distributorPrice || 0),
      dealerPrice: Number(row.dealerPrice || row.distributorPrice || 0),
      stockQty: Number(row.stockQty || 0),
      status: row.status || "active",
      searchText: "",
      updatedAt: row.updatedAt || now,
    };
    product.searchText = productSearchText(product);
    return product;
  });

  await offlineDb.transaction(
    "rw",
    [offlineDb.warehouses, offlineDb.categories, offlineDb.customers, offlineDb.products, offlineDb.settings, offlineDb.meta],
    async () => {
      await offlineDb.warehouses.bulkPut(warehouses);
      await offlineDb.categories.bulkPut(categories);
      await offlineDb.customers.bulkPut(customers);
      await offlineDb.products.bulkPut(products);
      if (payload.settings) {
        await offlineDb.settings.put({ key: "business", value: payload.settings, updatedAt: now });
      }
      await offlineDb.meta.put({ key: "last-bootstrap-at", value: now });
      await offlineDb.meta.put({ key: "last-server-time", value: payload.serverTime });
    },
  );

  notifyOfflineDataUpdated();
};

export const pullServerData = async (force = false) => {
  const last = await offlineDb.meta.get("last-bootstrap-at");
  if (!force && last?.value && Date.now() - new Date(last.value).getTime() < HOUR) return false;

  const response = await api<{ data: BootstrapPayload }>("/offline/bootstrap");
  await applyBootstrap(response.data);
  return true;
};

const markQueueFailure = async (row: SyncQueueRow, error: string) => {
  const retries = row.retries + 1;
  const delayMinutes = Math.min(60, Math.max(1, 2 ** Math.min(retries, 6)));
  await offlineDb.syncQueue.update(row.id, {
    status: "failed",
    retries,
    error,
    nextRetryAt: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await offlineDb.sales.update(row.entityId, { syncStatus: "failed", syncError: error, updatedAt: new Date().toISOString() });
};

export const pushPendingChanges = async () => {
  const now = new Date();
  const rows = await offlineDb.syncQueue.where("status").anyOf("pending", "failed").sortBy("createdAt");
  let synced = 0;

  for (const row of rows) {
    if (row.nextRetryAt && new Date(row.nextRetryAt) > now) continue;

    await offlineDb.syncQueue.update(row.id, { status: "syncing", updatedAt: new Date().toISOString() });

    try {
      if (row.entityType === "sale") {
        const result = await api<{ data: { sale: { _id: string; invoiceNo: string } } }>("/sales", {
          method: "POST",
          body: JSON.stringify(row.payload),
        });

        await offlineDb.transaction("rw", [offlineDb.syncQueue, offlineDb.sales], async () => {
          await offlineDb.syncQueue.update(row.id, {
            status: "synced",
            error: undefined,
            updatedAt: new Date().toISOString(),
          });
          await offlineDb.sales.update(row.entityId, {
            serverId: result.data.sale._id,
            invoiceNo: result.data.sale.invoiceNo,
            syncStatus: "synced",
            syncError: undefined,
            updatedAt: new Date().toISOString(),
          });
        });
        synced += 1;
      }
    } catch (error) {
      await markQueueFailure(row, error instanceof Error ? error.message : "Sync failed");
    }
  }

  await offlineDb.meta.put({ key: "last-sync-at", value: new Date().toISOString() });
  notifyOfflineDataUpdated();
  return synced;
};

export const runSyncCycle = async (forcePull = false) => {
  const reachable = await serverIsReachable();
  if (!reachable) {
    return { online: false, synced: 0, pending: await getPendingSyncCount() };
  }

  const synced = await pushPendingChanges();
  await pullServerData(forcePull);
  return { online: true, synced, pending: await getPendingSyncCount() };
};
