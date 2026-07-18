import Decimal from "decimal.js";
import { offlineDb, notifyOfflineDataUpdated } from "@/lib/offline-db";
import type { LocalSale, LocalSaleItem, SyncQueueRow } from "@/types/offline";

export type OfflineCheckoutItem = {
  productVariantId: string;
  quantity: number;
  salePrice: number;
  discount: number;
};

export type OfflineCheckoutInput = {
  customerId: string;
  warehouseId: string;
  saleType: string;
  paymentMethod: string;
  paidAmount: number;
  discountAmount: number;
  note?: string;
  items: OfflineCheckoutItem[];
};

const uuid = () => crypto.randomUUID();
const money = (value: Decimal.Value) => new Decimal(value).toDecimalPlaces(2).toNumber();

const deviceCode = async () => {
  const existing = await offlineDb.meta.get("device-code");
  if (existing?.value) return existing.value;
  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
  await offlineDb.meta.put({ key: "device-code", value: code });
  return code;
};

const nextInvoiceNo = async () => {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const key = `invoice-sequence-${date}`;
  const device = await deviceCode();
  const row = await offlineDb.meta.get(key);
  const next = Number(row?.value || 0) + 1;
  await offlineDb.meta.put({ key, value: String(next) });
  return `INV-${device}-${date}-${String(next).padStart(4, "0")}`;
};

export const createOfflineSale = async (input: OfflineCheckoutInput) => {
  if (!input.items.length) throw new Error("Cart is empty.");

  const now = new Date().toISOString();
  const clientUuid = uuid();
  const saleId = clientUuid;

  return offlineDb.transaction(
    "rw",
    [offlineDb.products, offlineDb.customers, offlineDb.sales, offlineDb.saleItems, offlineDb.syncQueue, offlineDb.meta],
    async () => {
      const customer = await offlineDb.customers.get(input.customerId);
      if (!customer) throw new Error("Customer not found in local database.");

      const invoiceNo = await nextInvoiceNo();
      const saleItems: LocalSaleItem[] = [];
      let subtotal = new Decimal(0);

      for (const requested of input.items) {
        if (!Number.isFinite(requested.quantity) || requested.quantity <= 0) {
          throw new Error("Invalid product quantity.");
        }

        const localProductId = `${input.warehouseId}:${requested.productVariantId}`;
        const product = await offlineDb.products.get(localProductId);
        if (!product || product.status !== "active") {
          throw new Error("Product is inactive or missing from local database.");
        }
        if (new Decimal(product.stockQty).lessThan(requested.quantity)) {
          throw new Error(`Not enough stock for ${product.name}. Available: ${product.stockQty}`);
        }

        const lineTotal = Decimal.max(
          0,
          new Decimal(requested.quantity).mul(requested.salePrice).minus(requested.discount || 0),
        );
        subtotal = subtotal.plus(lineTotal);

        saleItems.push({
          id: uuid(),
          saleId,
          productVariantId: requested.productVariantId,
          productNameSnapshot: product.name,
          skuSnapshot: product.sku,
          brandSnapshot: product.brand,
          sizeSnapshot: product.size,
          gaugeSnapshot: product.gauge,
          quantity: requested.quantity,
          purchasePriceSnapshot: product.purchasePrice,
          salePrice: money(requested.salePrice),
          discount: money(requested.discount || 0),
          total: money(lineTotal),
        });

        await offlineDb.products.update(localProductId, {
          stockQty: new Decimal(product.stockQty).minus(requested.quantity).toNumber(),
          updatedAt: now,
        });
      }

      const discountAmount = money(input.discountAmount || 0);
      const grandTotalDecimal = Decimal.max(0, subtotal.minus(discountAmount));
      const paidAmount = input.paymentMethod === "credit"
        ? 0
        : Decimal.min(new Decimal(input.paidAmount || 0), grandTotalDecimal).toNumber();
      const dueAmount = Decimal.max(0, grandTotalDecimal.minus(paidAmount)).toNumber();

      const sale: LocalSale = {
        id: saleId,
        clientUuid,
        invoiceNo,
        customerId: customer.serverId,
        customerName: customer.name,
        warehouseId: input.warehouseId,
        saleType: input.saleType,
        paymentMethod: input.paymentMethod,
        subtotal: money(subtotal),
        discountAmount,
        grandTotal: money(grandTotalDecimal),
        paidAmount: money(paidAmount),
        dueAmount: money(dueAmount),
        note: input.note,
        syncStatus: "pending",
        createdAt: now,
        updatedAt: now,
      };

      const queuePayload = {
        clientUuid,
        clientInvoiceNo: invoiceNo,
        customerId: customer.serverId,
        warehouseId: input.warehouseId,
        saleType: input.saleType,
        paymentMethod: input.paymentMethod,
        paidAmount: sale.paidAmount,
        discountAmount: sale.discountAmount,
        note: input.note,
        items: input.items,
      };

      const queue: SyncQueueRow = {
        id: uuid(),
        entityType: "sale",
        entityId: saleId,
        action: "create",
        payload: queuePayload,
        status: "pending",
        retries: 0,
        createdAt: now,
        updatedAt: now,
      };

      await offlineDb.sales.add(sale);
      await offlineDb.saleItems.bulkAdd(saleItems);
      await offlineDb.syncQueue.add(queue);

      if (dueAmount > 0) {
        await offlineDb.customers.update(customer.id, {
          currentBalance: new Decimal(customer.currentBalance || 0).plus(dueAmount).toNumber(),
          updatedAt: now,
        });
      }

      notifyOfflineDataUpdated();
      return sale;
    },
  );
};
