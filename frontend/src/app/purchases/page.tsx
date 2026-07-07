"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Master = {
  _id: string;
  name: string;
  type?: string;
};

type Supplier = {
  _id: string;
  name: string;
  phone?: string;
  currentBalance: number;
};

type Variant = {
  _id: string;
  name: string;
  sku: string;
  purchasePrice: number;
  retailPrice: number;
  saleUnit: string;
  brandId?: Master;
  sizeId?: Master;
};

type Purchase = {
  _id: string;
  purchaseNo: string;
  supplierId?: Supplier;
  warehouseId?: Master;
  items: {
    productVariantId: string;
    productNameSnapshot: string;
    skuSnapshot: string;
    quantity: number;
    purchasePrice: number;
    total: number;
  }[];
  subtotal: number;
  discountAmount: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  note?: string;
  createdAt: string;
};

type PurchaseItem = {
  productVariantId: string;
  quantity: string;
  purchasePrice: string;
};

type PurchaseForm = {
  supplierId: string;
  warehouseId: string;
  items: PurchaseItem[];
  discountAmount: string;
  paidAmount: string;
  paymentMethod: string;
  note: string;
};

const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

export default function PurchasesPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Master[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const [form, setForm] = useState<PurchaseForm>({
    supplierId: "",
    warehouseId: "",
    items: [{ productVariantId: "", quantity: "1", purchasePrice: "0" }],
    discountAmount: "0",
    paidAmount: "0",
    paymentMethod: "cash",
    note: ""
  });

  const [supplierFilter, setSupplierFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    setError("");

    try {
      const [supplierRes, warehouseRes, variantRes, purchaseRes] = await Promise.all([
        api<{ data: Supplier[] }>("/suppliers"),
        api<{ data: Master[] }>("/master/warehouses"),
        api<{ data: Variant[] }>("/products/variants"),
        api<{ data: Purchase[] }>("/purchases")
      ]);

      setSuppliers(supplierRes.data);
      setWarehouses(warehouseRes.data);
      setVariants(variantRes.data);
      setPurchases(purchaseRes.data);

      setForm((prev) => ({
        ...prev,
        supplierId: prev.supplierId || supplierRes.data[0]?._id || "",
        warehouseId:
          prev.warehouseId ||
          warehouseRes.data.find((w) => w.type === "godown")?._id ||
          warehouseRes.data[0]?._id ||
          "",
        items: prev.items.map((item) => {
          const variant = variantRes.data[0];
          return {
            ...item,
            productVariantId: item.productVariantId || variant?._id || "",
            purchasePrice:
              item.purchasePrice !== "0" ? item.purchasePrice : String(variant?.purchasePrice || 0)
          };
        })
      }));
    } catch (err: any) {
      setError(err.message || "Purchase data load failed");
    } finally {
      setLoading(false);
    }
  };

  const loadPurchases = async () => {
    const query = supplierFilter ? `?supplierId=${supplierFilter}` : "";
    const res = await api<{ data: Purchase[] }>(`/purchases${query}`);
    setPurchases(res.data);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((sum, item) => {
      return sum + Number(item.quantity || 0) * Number(item.purchasePrice || 0);
    }, 0);

    const discountAmount = Number(form.discountAmount || 0);
    const grandTotal = Math.max(0, subtotal - discountAmount);
    const paidAmount = Math.min(Number(form.paidAmount || 0), grandTotal);
    const dueAmount = Math.max(0, grandTotal - paidAmount);

    return { subtotal, discountAmount, grandTotal, paidAmount, dueAmount };
  }, [form.items, form.discountAmount, form.paidAmount]);

  const addItem = () => {
    const firstVariant = variants[0];
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          productVariantId: firstVariant?._id || "",
          quantity: "1",
          purchasePrice: String(firstVariant?.purchasePrice || 0)
        }
      ]
    }));
  };

  const removeItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, patch: Partial<PurchaseItem>) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    }));
  };

  const onVariantChange = (index: number, productVariantId: string) => {
    const variant = variants.find((item) => item._id === productVariantId);
    updateItem(index, {
      productVariantId,
      purchasePrice: String(variant?.purchasePrice || 0)
    });
  };

  const submitPurchase = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      const items = form.items
        .filter((item) => item.productVariantId && Number(item.quantity) > 0)
        .map((item) => ({
          productVariantId: item.productVariantId,
          quantity: Number(item.quantity),
          purchasePrice: Number(item.purchasePrice)
        }));

      if (!items.length) {
        throw new Error("Please add at least one purchase item.");
      }

      await api("/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplierId: form.supplierId,
          warehouseId: form.warehouseId,
          items,
          discountAmount: Number(form.discountAmount || 0),
          paidAmount: Number(form.paidAmount || 0),
          paymentMethod: form.paymentMethod,
          note: form.note
        })
      });

      setMessage("Purchase created. Stock and supplier ledger updated.");
      setForm((prev) => ({
        ...prev,
        items: [
          {
            productVariantId: variants[0]?._id || "",
            quantity: "1",
            purchasePrice: String(variants[0]?.purchasePrice || 0)
          }
        ],
        discountAmount: "0",
        paidAmount: "0",
        note: ""
      }));

      await loadAll();
    } catch (err: any) {
      setError(err.message || "Purchase save failed");
    } finally {
      setSaving(false);
    }
  };

  const totalPurchases = purchases.reduce((sum, purchase) => sum + Number(purchase.grandTotal || 0), 0);
  const totalDue = purchases.reduce((sum, purchase) => sum + Number(purchase.dueAmount || 0), 0);

  return (
    <DashboardLayout title="Purchases">
      <div className="page-header">
        <div>
          <h2>Purchases</h2>
          <p>Supplier se purchase add karo, stock selected godown/shop me auto increase hoga.</p>
        </div>

        <button className="btn btn-light" onClick={loadAll}>
          Refresh
        </button>
      </div>

      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      <div className="grid stats-grid">
        <Stat title="Total Purchases" value={String(purchases.length)} />
        <Stat title="Purchase Value" value={money(totalPurchases)} />
        <Stat title="Purchase Due" value={money(totalDue)} />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-title">
          <h3>Create Purchase</h3>
          <button className="small-btn" type="button" onClick={addItem}>
            Add Item
          </button>
        </div>

        {loading ? (
          <p className="placeholder">Loading...</p>
        ) : suppliers.length === 0 ? (
          <div className="notice danger">Please create a supplier first from Suppliers page.</div>
        ) : variants.length === 0 ? (
          <div className="notice danger">Please create product variants first from Products page.</div>
        ) : (
          <form onSubmit={submitPurchase}>
            <div className="form-grid">
              <div className="form-group">
                <label>Supplier</label>
                <select
                  className="select"
                  value={form.supplierId}
                  onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                  required
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.name} — Payable {money(supplier.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Stock Location</label>
                <select
                  className="select"
                  value={form.warehouseId}
                  onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
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
            </div>

            <div className="purchase-items">
              {form.items.map((item, index) => {
                const lineTotal = Number(item.quantity || 0) * Number(item.purchasePrice || 0);

                return (
                  <div className="purchase-row" key={index}>
                    <div className="form-group">
                      <label>Item</label>
                      <select
                        className="select"
                        value={item.productVariantId}
                        onChange={(e) => onVariantChange(index, e.target.value)}
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
                      <label>Qty</label>
                      <input
                        className="input"
                        type="number"
                        step="0.001"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Purchase Price</label>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        value={item.purchasePrice}
                        onChange={(e) => updateItem(index, { purchasePrice: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Total</label>
                      <div className="readonly-box">{money(lineTotal)}</div>
                    </div>

                    <div className="form-group">
                      <label>&nbsp;</label>
                      <button
                        type="button"
                        className="small-btn danger-text"
                        onClick={() => removeItem(index)}
                        disabled={form.items.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="purchase-summary">
              <div className="form-group">
                <label>Discount</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={form.discountAmount}
                  onChange={(e) => setForm({ ...form, discountAmount: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Paid Amount</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={form.paidAmount}
                  onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <select
                  className="select"
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="cheque">Cheque</option>
                  <option value="credit">Credit</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="summary-box">
                <div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
                <div><span>Discount</span><strong>{money(totals.discountAmount)}</strong></div>
                <div><span>Grand Total</span><strong>{money(totals.grandTotal)}</strong></div>
                <div><span>Paid</span><strong>{money(totals.paidAmount)}</strong></div>
                <div><span>Due / Payable</span><strong>{money(totals.dueAmount)}</strong></div>
              </div>
            </div>

            <div className="form-group">
              <label>Note</label>
              <textarea
                className="input"
                rows={3}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Invoice no, bill note, transport note"
              />
            </div>

            <button className="btn" disabled={saving}>
              {saving ? "Saving Purchase..." : "Save Purchase"}
            </button>
          </form>
        )}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-title">
          <h3>Purchase History</h3>
          <span className="badge">{purchases.length} records</span>
        </div>

        <div className="filter-row">
          <select
            className="select"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier._id} value={supplier._id}>{supplier.name}</option>
            ))}
          </select>

          <button className="btn btn-light" onClick={loadPurchases}>
            Apply Filter
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Purchase No</th>
                <th>Supplier</th>
                <th>Warehouse</th>
                <th>Items</th>
                <th>Total</th>
                <th>Paid / Due</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr><td colSpan={8}>No purchases found.</td></tr>
              ) : (
                purchases.map((purchase) => (
                  <tr key={purchase._id}>
                    <td><strong>{purchase.purchaseNo}</strong></td>
                    <td>{purchase.supplierId?.name || "-"}</td>
                    <td>{purchase.warehouseId?.name || "-"}</td>
                    <td>
                      {purchase.items.slice(0, 2).map((item) => (
                        <div key={`${purchase._id}-${item.skuSnapshot}`}>
                          {item.productNameSnapshot} × {item.quantity}
                        </div>
                      ))}
                      {purchase.items.length > 2 ? (
                        <div className="muted-small">+{purchase.items.length - 2} more</div>
                      ) : null}
                    </td>
                    <td>{money(purchase.grandTotal)}</td>
                    <td>
                      <div>Paid: {money(purchase.paidAmount)}</div>
                      <div className="muted-small">Due: {money(purchase.dueAmount)}</div>
                    </td>
                    <td><span className="badge">{purchase.paymentStatus}</span></td>
                    <td>{new Date(purchase.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="card">
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
