"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Master = {
  _id: string;
  name: string;
  type?: string;
};

type Variant = {
  _id: string;
  name: string;
  sku: string;
  barcode?: string;
  lowStockAlertQty: number;
  saleUnit: string;
  baseUnit: string;
  lengthPerPiece?: number;
  purchasePrice?: number;
  retailPrice?: number;
  plumberPrice?: number;
  brandId?: Master;
  categoryId?: Master;
  sizeId?: Master;
  unitId?: Master;
};

type StockRow = {
  _id: string;
  warehouseId: Master;
  productVariantId: Variant;
  quantity: number;
  updatedAt: string;
};

type Movement = {
  _id: string;
  warehouseId?: Master;
  productVariantId?: Pick<Variant, "_id" | "name" | "sku">;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  note?: string;
  createdAt: string;
};

type Transfer = {
  _id: string;
  transferNo: string;
  fromWarehouseId?: Master;
  toWarehouseId?: Master;
  items: {
    productVariantId: string;
    productNameSnapshot: string;
    skuSnapshot: string;
    quantity: number;
  }[];
  note?: string;
  createdAt: string;
};

type AdjustForm = {
  warehouseId: string;
  productVariantId: string;
  newQuantity: string;
  note: string;
};

type TransferItem = {
  productVariantId: string;
  quantity: string;
};

type TransferForm = {
  fromWarehouseId: string;
  toWarehouseId: string;
  items: TransferItem[];
  note: string;
};

const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

const movementLabel: Record<string, string> = {
  purchase: "Purchase",
  sale: "Sale",
  return: "Return",
  damage: "Damage",
  adjustment: "Adjustment",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
  opening_stock: "Opening Stock"
};

export default function InventoryPage() {
  const [warehouses, setWarehouses] = useState<Master[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [valuation, setValuation] = useState({ purchaseValue: 0, retailValue: 0 });

  const [adjustForm, setAdjustForm] = useState<AdjustForm>({
    warehouseId: "",
    productVariantId: "",
    newQuantity: "0",
    note: ""
  });

  const [transferForm, setTransferForm] = useState<TransferForm>({
    fromWarehouseId: "",
    toWarehouseId: "",
    items: [{ productVariantId: "", quantity: "1" }],
    note: ""
  });

  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [search, setSearch] = useState("");
  const [movementWarehouseFilter, setMovementWarehouseFilter] = useState("");
  const [movementVariantFilter, setMovementVariantFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    setError("");

    try {
      const [warehouseRes, variantRes, stockRes, movementRes, transferRes, valuationRes] =
        await Promise.all([
          api<{ data: Master[] }>("/master/warehouses"),
          api<{ data: Variant[] }>("/products/variants"),
          api<{ data: StockRow[] }>("/inventory/stocks"),
          api<{ data: Movement[] }>("/inventory/movements"),
          api<{ data: Transfer[] }>("/inventory/transfers"),
          api<{ data: { purchaseValue: number; retailValue: number } }>("/inventory/valuation")
        ]);

      setWarehouses(warehouseRes.data);
      setVariants(variantRes.data);
      setStocks(stockRes.data);
      setMovements(movementRes.data);
      setTransfers(transferRes.data);
      setValuation({
        purchaseValue: valuationRes.data.purchaseValue,
        retailValue: valuationRes.data.retailValue
      });

      setAdjustForm((prev) => ({
        ...prev,
        warehouseId: prev.warehouseId || warehouseRes.data[0]?._id || "",
        productVariantId: prev.productVariantId || variantRes.data[0]?._id || ""
      }));

      setTransferForm((prev) => ({
        ...prev,
        fromWarehouseId:
          prev.fromWarehouseId ||
          warehouseRes.data.find((w) => w.type === "godown")?._id ||
          warehouseRes.data[0]?._id ||
          "",
        toWarehouseId:
          prev.toWarehouseId ||
          warehouseRes.data.find((w) => w.type === "shop")?._id ||
          warehouseRes.data[1]?._id ||
          "",
        items: prev.items.map((item) => ({
          ...item,
          productVariantId: item.productVariantId || variantRes.data[0]?._id || ""
        }))
      }));
    } catch (err: any) {
      setError(err.message || "Inventory data load failed");
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async () => {
    const params = new URLSearchParams();
    if (movementWarehouseFilter) params.set("warehouseId", movementWarehouseFilter);
    if (movementVariantFilter) params.set("productVariantId", movementVariantFilter);

    const res = await api<{ data: Movement[] }>(`/inventory/movements?${params.toString()}`);
    setMovements(res.data);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filteredStocks = useMemo(() => {
    const q = search.trim().toLowerCase();

    return stocks.filter((stock) => {
      const matchesWarehouse = warehouseFilter ? stock.warehouseId?._id === warehouseFilter : true;

      if (!q) return matchesWarehouse;

      const variant = stock.productVariantId;
      const text = [
        variant?.name,
        variant?.sku,
        variant?.barcode,
        variant?.brandId?.name,
        variant?.categoryId?.name,
        variant?.sizeId?.name,
        stock.warehouseId?.name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesWarehouse && text.includes(q);
    });
  }, [stocks, search, warehouseFilter]);

  const lowStockRows = filteredStocks.filter((stock) => {
    const alertQty = stock.productVariantId?.lowStockAlertQty || 0;
    return stock.quantity > 0 && stock.quantity <= alertQty;
  });

  const outOfStockRows = filteredStocks.filter((stock) => stock.quantity <= 0);

  const submitAdjustStock = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSavingAdjust(true);

    try {
      await api("/inventory/adjust-stock", {
        method: "POST",
        body: JSON.stringify({
          warehouseId: adjustForm.warehouseId,
          productVariantId: adjustForm.productVariantId,
          newQuantity: Number(adjustForm.newQuantity || 0),
          note: adjustForm.note || "Opening/manual stock adjustment"
        })
      });

      setMessage("Stock adjusted successfully.");
      setAdjustForm((prev) => ({ ...prev, newQuantity: "0", note: "" }));
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Stock adjustment failed");
    } finally {
      setSavingAdjust(false);
    }
  };

  const submitTransfer = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSavingTransfer(true);

    try {
      const items = transferForm.items
        .filter((item) => item.productVariantId && Number(item.quantity) > 0)
        .map((item) => ({
          productVariantId: item.productVariantId,
          quantity: Number(item.quantity)
        }));

      if (items.length === 0) {
        throw new Error("Please add at least one transfer item.");
      }

      await api("/inventory/transfer", {
        method: "POST",
        body: JSON.stringify({
          fromWarehouseId: transferForm.fromWarehouseId,
          toWarehouseId: transferForm.toWarehouseId,
          items,
          note: transferForm.note || "Godown/shop stock transfer"
        })
      });

      setMessage("Stock transferred successfully.");
      setTransferForm((prev) => ({
        ...prev,
        items: [{ productVariantId: variants[0]?._id || "", quantity: "1" }],
        note: ""
      }));
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Stock transfer failed");
    } finally {
      setSavingTransfer(false);
    }
  };

  const addTransferItem = () => {
    setTransferForm((prev) => ({
      ...prev,
      items: [...prev.items, { productVariantId: variants[0]?._id || "", quantity: "1" }]
    }));
  };

  const removeTransferItem = (index: number) => {
    setTransferForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateTransferItem = (index: number, patch: Partial<TransferItem>) => {
    setTransferForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    }));
  };

  return (
    <DashboardLayout title="Inventory">
      <div className="page-header">
        <div>
          <h2>Inventory & Godown Stock</h2>
          <p>Opening stock, adjustment, godown transfer, low stock aur stock movement history.</p>
        </div>

        <button className="btn btn-light" onClick={loadAll}>
          Refresh
        </button>
      </div>

      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      {loading ? (
        <div className="card">Loading inventory...</div>
      ) : (
        <>
          <div className="grid stats-grid">
            <StatCard title="Total Stock Rows" value={String(stocks.length)} />
            <StatCard title="Low Stock" value={String(lowStockRows.length)} />
            <StatCard title="Out of Stock" value={String(outOfStockRows.length)} />
            <StatCard title="Purchase Value" value={money(valuation.purchaseValue)} />
            <StatCard title="Retail Value" value={money(valuation.retailValue)} />
          </div>

          <div className="two-column" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="section-title">
                <h3>Opening / Adjust Stock</h3>
                <span className="badge">Set exact stock</span>
              </div>

              <form onSubmit={submitAdjustStock}>
                <div className="form-group">
                  <label>Warehouse / Godown</label>
                  <select
                    className="select"
                    value={adjustForm.warehouseId}
                    onChange={(e) => setAdjustForm({ ...adjustForm, warehouseId: e.target.value })}
                    required
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse._id} value={warehouse._id}>
                        {warehouse.name} ({warehouse.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Product Variant</label>
                  <select
                    className="select"
                    value={adjustForm.productVariantId}
                    onChange={(e) => setAdjustForm({ ...adjustForm, productVariantId: e.target.value })}
                    required
                  >
                    <option value="">Select item</option>
                    {variants.map((variant) => (
                      <option key={variant._id} value={variant._id}>
                        {variant.name} — {variant.sku}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>New Stock Quantity</label>
                  <input
                    className="input"
                    type="number"
                    step="0.001"
                    value={adjustForm.newQuantity}
                    onChange={(e) => setAdjustForm({ ...adjustForm, newQuantity: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Note</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={adjustForm.note}
                    onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
                    placeholder="Opening stock / physical stock correction"
                  />
                </div>

                <button className="btn" disabled={savingAdjust}>
                  {savingAdjust ? "Saving..." : "Adjust Stock"}
                </button>
              </form>
            </div>

            <div className="card">
              <div className="section-title">
                <h3>Godown / Shop Transfer</h3>
                <button className="small-btn" onClick={addTransferItem} type="button">
                  Add Item
                </button>
              </div>

              <form onSubmit={submitTransfer}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>From</label>
                    <select
                      className="select"
                      value={transferForm.fromWarehouseId}
                      onChange={(e) => setTransferForm({ ...transferForm, fromWarehouseId: e.target.value })}
                      required
                    >
                      <option value="">Select from</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse._id} value={warehouse._id}>
                          {warehouse.name} ({warehouse.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>To</label>
                    <select
                      className="select"
                      value={transferForm.toWarehouseId}
                      onChange={(e) => setTransferForm({ ...transferForm, toWarehouseId: e.target.value })}
                      required
                    >
                      <option value="">Select to</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse._id} value={warehouse._id}>
                          {warehouse.name} ({warehouse.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="transfer-items">
                  {transferForm.items.map((item, index) => (
                    <div className="transfer-row" key={index}>
                      <select
                        className="select"
                        value={item.productVariantId}
                        onChange={(e) => updateTransferItem(index, { productVariantId: e.target.value })}
                        required
                      >
                        <option value="">Select item</option>
                        {variants.map((variant) => (
                          <option key={variant._id} value={variant._id}>
                            {variant.name} — {variant.sku}
                          </option>
                        ))}
                      </select>

                      <input
                        className="input"
                        type="number"
                        step="0.001"
                        value={item.quantity}
                        onChange={(e) => updateTransferItem(index, { quantity: e.target.value })}
                        placeholder="Qty"
                        required
                      />

                      <button
                        type="button"
                        className="small-btn danger-text"
                        onClick={() => removeTransferItem(index)}
                        disabled={transferForm.items.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="form-group">
                  <label>Note</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={transferForm.note}
                    onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
                    placeholder="Godown se shop stock shift"
                  />
                </div>

                <button className="btn" disabled={savingTransfer}>
                  {savingTransfer ? "Transferring..." : "Transfer Stock"}
                </button>
              </form>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="section-title">
              <h3>Warehouse-wise Stock</h3>
              <span className="badge">{filteredStocks.length} rows</span>
            </div>

            <div className="filter-row">
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search item, SKU, brand, size, warehouse"
              />

              <select
                className="select"
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
              >
                <option value="">All warehouses</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse._id} value={warehouse._id}>
                    {warehouse.name} ({warehouse.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Warehouse</th>
                    <th>Item</th>
                    <th>Brand / Size</th>
                    <th>Qty</th>
                    <th>Alert</th>
                    <th>Stock Status</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.length === 0 ? (
                    <tr><td colSpan={7}>No stock rows found. Add opening stock first.</td></tr>
                  ) : (
                    filteredStocks.map((stock) => {
                      const variant = stock.productVariantId;
                      const lowAlert = variant?.lowStockAlertQty || 0;
                      const isOut = stock.quantity <= 0;
                      const isLow = stock.quantity > 0 && stock.quantity <= lowAlert;

                      return (
                        <tr key={stock._id}>
                          <td>
                            <strong>{stock.warehouseId?.name}</strong>
                            <div className="muted-small">{stock.warehouseId?.type}</div>
                          </td>
                          <td>
                            <strong>{variant?.name || "-"}</strong>
                            <div className="muted-small">{variant?.sku || "-"}</div>
                          </td>
                          <td>
                            {variant?.brandId?.name || "-"}
                            <div className="muted-small">Size: {variant?.sizeId?.name || "-"}</div>
                          </td>
                          <td>
                            <strong>{stock.quantity}</strong>
                            <div className="muted-small">{variant?.saleUnit || ""}</div>
                          </td>
                          <td>{lowAlert}</td>
                          <td>
                            {isOut ? (
                              <span className="badge badge-danger">Out</span>
                            ) : isLow ? (
                              <span className="badge badge-warning">Low</span>
                            ) : (
                              <span className="badge badge-success">OK</span>
                            )}
                          </td>
                          <td>
                            <div>{money(Number(variant?.purchasePrice || 0) * Number(stock.quantity || 0))}</div>
                            <div className="muted-small">purchase value</div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="two-column" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="section-title">
                <h3>Stock Movement History</h3>
                <button className="small-btn" onClick={loadMovements}>Apply Filter</button>
              </div>

              <div className="filter-row three">
                <select
                  className="select"
                  value={movementWarehouseFilter}
                  onChange={(e) => setMovementWarehouseFilter(e.target.value)}
                >
                  <option value="">All warehouses</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse._id} value={warehouse._id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>

                <select
                  className="select"
                  value={movementVariantFilter}
                  onChange={(e) => setMovementVariantFilter(e.target.value)}
                >
                  <option value="">All items</option>
                  {variants.map((variant) => (
                    <option key={variant._id} value={variant._id}>
                      {variant.name}
                    </option>
                  ))}
                </select>

                <button
                  className="small-btn"
                  type="button"
                  onClick={() => {
                    setMovementWarehouseFilter("");
                    setMovementVariantFilter("");
                    setTimeout(loadMovements, 0);
                  }}
                >
                  Clear
                </button>
              </div>

              <div className="table-wrap compact-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.length === 0 ? (
                      <tr><td colSpan={5}>No movement found.</td></tr>
                    ) : (
                      movements.map((movement) => (
                        <tr key={movement._id}>
                          <td>{new Date(movement.createdAt).toLocaleDateString()}</td>
                          <td>
                            <strong>{movement.productVariantId?.name || "-"}</strong>
                            <div className="muted-small">{movement.warehouseId?.name || "-"}</div>
                          </td>
                          <td>{movementLabel[movement.type] || movement.type}</td>
                          <td>{movement.quantity}</td>
                          <td>
                            {movement.previousStock} → {movement.newStock}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="section-title">
                <h3>Recent Transfers</h3>
                <span className="badge">{transfers.length} transfers</span>
              </div>

              <div className="table-wrap compact-table">
                <table>
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>From → To</th>
                      <th>Items</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.length === 0 ? (
                      <tr><td colSpan={4}>No transfer yet.</td></tr>
                    ) : (
                      transfers.map((transfer) => (
                        <tr key={transfer._id}>
                          <td><strong>{transfer.transferNo}</strong></td>
                          <td>
                            {transfer.fromWarehouseId?.name || "-"} → {transfer.toWarehouseId?.name || "-"}
                            <div className="muted-small">{transfer.note || ""}</div>
                          </td>
                          <td>
                            {transfer.items.slice(0, 2).map((item) => (
                              <div key={`${transfer._id}-${item.skuSnapshot}`}>
                                {item.productNameSnapshot} × {item.quantity}
                              </div>
                            ))}
                            {transfer.items.length > 2 ? (
                              <div className="muted-small">+{transfer.items.length - 2} more</div>
                            ) : null}
                          </td>
                          <td>{new Date(transfer.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="card">
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
