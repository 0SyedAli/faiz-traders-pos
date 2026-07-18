export type SyncStatus = "offline" | "online" | "syncing" | "failed";
export type QueueStatus = "pending" | "syncing" | "synced" | "failed";

export type LocalWarehouse = {
  id: string;
  serverId: string;
  name: string;
  type: string;
  updatedAt: string;
};

export type LocalCategory = {
  id: string;
  serverId: string;
  name: string;
  updatedAt: string;
};

export type LocalCustomer = {
  id: string;
  serverId: string;
  name: string;
  phone?: string;
  customerType: string;
  currentBalance: number;
  status: string;
  updatedAt: string;
};

export type LocalProduct = {
  id: string;
  serverId: string;
  warehouseId: string;
  categoryId: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  size: string;
  gauge: string;
  lengthFeet: number;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  distributorPrice: number;
  dealerPrice: number;
  stockQty: number;
  status: string;
  searchText: string;
  updatedAt: string;
};

export type LocalSetting = {
  key: string;
  value: unknown;
  updatedAt: string;
};

export type LocalSale = {
  id: string;
  clientUuid: string;
  invoiceNo: string;
  serverId?: string;
  customerId: string;
  customerName: string;
  warehouseId: string;
  saleType: string;
  paymentMethod: string;
  subtotal: number;
  discountAmount: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  note?: string;
  syncStatus: QueueStatus;
  syncError?: string;
  createdAt: string;
  updatedAt: string;
};

export type LocalSaleItem = {
  id: string;
  saleId: string;
  productVariantId: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  brandSnapshot: string;
  sizeSnapshot: string;
  gaugeSnapshot: string;
  quantity: number;
  purchasePriceSnapshot: number;
  salePrice: number;
  discount: number;
  total: number;
};

export type LocalExpense = {
  id: string;
  clientUuid: string;
  title: string;
  amount: number;
  categoryId?: string;
  paymentMethod: string;
  expenseDate: string;
  note?: string;
  syncStatus: QueueStatus;
  createdAt: string;
  updatedAt: string;
};

export type SyncQueueRow = {
  id: string;
  entityType: "sale" | "expense" | "customer";
  entityId: string;
  action: "create" | "update";
  payload: unknown;
  status: QueueStatus;
  retries: number;
  nextRetryAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type LocalAuthRow = {
  email: string;
  salt: string;
  passwordHash: string;
  token: string;
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  updatedAt: string;
};

export type LocalMeta = {
  key: string;
  value: string;
};
