"use client";

import Link from "next/link";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Customer = { _id: string; name: string; phone?: string; customerType: string; currentBalance: number };
type Warehouse = { _id: string; name: string; type: string };

type Sale = {
  _id: string;
  invoiceNo: string;
  customerId?: Customer;
  warehouseId?: Warehouse;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: string;
  paymentMethod: string;
  saleType: string;
  createdAt: string;
};

type ReturnableItem = {
  productVariantId: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  soldQty: number;
  alreadyReturned: number;
  remainingQty: number;
  unitPrice: number;
  lineTotal: number;
};

type ReturnInput = { productVariantId: string; quantity: string; condition: "resellable" | "damaged" };

type SalesReturn = {
  _id: string;
  returnNo: string;
  saleId?: { invoiceNo: string; grandTotal: number };
  customerId?: Customer;
  warehouseId?: Warehouse;
  items: { productVariantId: string; productNameSnapshot: string; skuSnapshot: string; quantity: number; unitPrice: number; total: number; condition: string }[];
  totalReturnAmount: number;
  refundMethod: string;
  adjustInKhata: boolean;
  note?: string;
  createdAt: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

export default function SalesReturnsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [saleId, setSaleId] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [returnableItems, setReturnableItems] = useState<ReturnableItem[]>([]);
  const [returnItems, setReturnItems] = useState<ReturnInput[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [refundMethod, setRefundMethod] = useState<"adjust_credit" | "cash" | "no_refund">("adjust_credit");
  const [adjustInKhata, setAdjustInKhata] = useState(true);
  const [note, setNote] = useState("");

  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(today());
  const [customerFilter, setCustomerFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingSale, setLoadingSale] = useState(false);
  const [savingReturn, setSavingReturn] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadBase = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (customerFilter) params.set("customerId", customerFilter);

      const [salesRes, returnsRes, warehouseRes] = await Promise.all([
        api<{ data: Sale[] }>(`/sales?${params.toString()}`),
        api<{ data: SalesReturn[] }>("/sales-returns"),
        api<{ data: Warehouse[] }>("/master/warehouses")
      ]);

      setSales(salesRes.data);
      setReturns(returnsRes.data);
      setWarehouses(warehouseRes.data);
    } catch (err: any) {
      setError(err.message || "Sales returns data load failed");
    } finally {
      setLoading(false);
    }
  };

  const loadSaleForReturn = async (id: string) => {
    if (!id) {
      setSelectedSale(null);
      setReturnableItems([]);
      setReturnItems([]);
      return;
    }

    setLoadingSale(true);
    setError("");
    setSaleId(id);

    try {
      const res = await api<{ data: { sale: Sale; returnableItems: ReturnableItem[] } }>(`/sales-returns/sale/${id}`);

      setSelectedSale(res.data.sale);
      setReturnableItems(res.data.returnableItems);
      setWarehouseId(res.data.sale.warehouseId?._id || "");

      setReturnItems(
        res.data.returnableItems
          .filter((item) => item.remainingQty > 0)
          .map((item) => ({ productVariantId: item.productVariantId, quantity: "0", condition: "resellable" as const }))
      );
    } catch (err: any) {
      setError(err.message || "Invoice load failed");
    } finally {
      setLoadingSale(false);
    }
  };

  useEffect(() => { loadBase(); }, []);

  const customersFromSales = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const sale of sales) {
      if (sale.customerId?._id) map.set(sale.customerId._id, sale.customerId);
    }
    return Array.from(map.values());
  }, [sales]);

  const totalReturnAmount = useMemo(() => {
    return returnItems.reduce((sum, input) => {
      const qty = Number(input.quantity || 0);
      const item = returnableItems.find((r) => String(r.productVariantId) === String(input.productVariantId));
      return sum + qty * Number(item?.unitPrice || 0);
    }, 0);
  }, [returnItems, returnableItems]);

  const updateReturnItem = (productVariantId: string, patch: Partial<ReturnInput>) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (String(item.productVariantId) !== String(productVariantId)) return item;

        if (patch.quantity !== undefined) {
          const returnable = returnableItems.find((r) => String(r.productVariantId) === String(productVariantId));
          const qty = Number(patch.quantity || 0);
          if (returnable && qty > returnable.remainingQty) {
            setError(`Return quantity cannot exceed remaining quantity for ${returnable.productNameSnapshot}.`);
            return item;
          }
        }

        return { ...item, ...patch };
      })
    );
  };

  const submitReturn = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSavingReturn(true);

    try {
      if (!saleId) throw new Error("Please select invoice.");
      if (!warehouseId) throw new Error("Please select return warehouse.");

      const items = returnItems
        .filter((item) => Number(item.quantity || 0) > 0)
        .map((item) => ({ productVariantId: item.productVariantId, quantity: Number(item.quantity || 0), condition: item.condition }));

      if (!items.length) throw new Error("Please enter at least one return quantity.");

      await api("/sales-returns", {
        method: "POST",
        body: JSON.stringify({ saleId, warehouseId, items, refundMethod, adjustInKhata, note })
      });

      setMessage("Sales return created. Stock/khata updated where applicable.");
      setSaleId("");
      setSelectedSale(null);
      setReturnableItems([]);
      setReturnItems([]);
      setNote("");
      setRefundMethod("adjust_credit");
      setAdjustInKhata(true);
      await loadBase();
    } catch (err: any) {
      setError(err.message || "Return save failed");
    } finally {
      setSavingReturn(false);
    }
  };

  return (
    <DashboardLayout title="Sales Returns">
      <div className="page-header">
        <div>
          <h2>Sales Returns / Plumber Leftover</h2>
          <p>Invoice ke against leftover saman return karo, stock wapas add karo aur khata adjust karo.</p>
        </div>
        <button className="btn btn-light" onClick={loadBase}>Refresh</button>
      </div>

      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      <div className="card">
        <div className="section-title">
          <h3>Find Invoice</h3>
          <span className="badge">{sales.length} invoices</span>
        </div>

        <div className="filter-row reports-filter">
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <select className="select" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
            <option value="">All customers</option>
            {customersFromSales.map((customer) => (
              <option key={customer._id} value={customer._id}>{customer.name} — {customer.customerType}</option>
            ))}
          </select>
          <button className="btn btn-light" onClick={loadBase}>Apply</button>
        </div>

        <div className="form-group">
          <label>Select Invoice</label>
          <select className="select" value={saleId} onChange={(e) => loadSaleForReturn(e.target.value)}>
            <option value="">Select sale invoice</option>
            {sales.map((sale) => (
              <option key={sale._id} value={sale._id}>
                {sale.invoiceNo} — {sale.customerId?.name || "Walk-in"} — {money(sale.grandTotal)} — {new Date(sale.createdAt).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadingSale ? (
        <div className="card" style={{ marginTop: 18 }}>Loading invoice...</div>
      ) : selectedSale ? (
        <form onSubmit={submitReturn}>
          <div className="two-column" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="section-title"><h3>Invoice Detail</h3><span className="badge">{selectedSale.invoiceNo}</span></div>
              <div className="return-info-grid">
                <div><span>Customer</span><strong>{selectedSale.customerId?.name || "-"}</strong></div>
                <div><span>Customer Type</span><strong>{selectedSale.customerId?.customerType || "-"}</strong></div>
                <div><span>Invoice Total</span><strong>{money(selectedSale.grandTotal)}</strong></div>
                <div><span>Due</span><strong>{money(selectedSale.dueAmount)}</strong></div>
                <div><span>Warehouse</span><strong>{selectedSale.warehouseId?.name || "-"}</strong></div>
                <div><span>Date</span><strong>{new Date(selectedSale.createdAt).toLocaleString()}</strong></div>
              </div>
            </div>

            <div className="card">
              <div className="section-title"><h3>Return Settings</h3><span className="badge">{money(totalReturnAmount)}</span></div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Return Stock Location</label>
                  <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                    <option value="">Select warehouse</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse._id} value={warehouse._id}>{warehouse.name} ({warehouse.type})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Refund Method</label>
                  <select className="select" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value as any)}>
                    <option value="adjust_credit">Adjust in Khata</option>
                    <option value="cash">Cash Refund</option>
                    <option value="no_refund">No Refund</option>
                  </select>
                </div>
              </div>

              <label className="checkbox-line">
                <input type="checkbox" checked={adjustInKhata} onChange={(e) => setAdjustInKhata(e.target.checked)} disabled={refundMethod !== "adjust_credit"} />
                Adjust customer/plumber khata balance
              </label>

              <div className="form-group">
                <label>Note</label>
                <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Job ke baad leftover fitting return" />
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="section-title"><h3>Return Items</h3><span className="badge">Total Return: {money(totalReturnAmount)}</span></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Item</th><th>Sold</th><th>Returned</th><th>Remaining</th><th>Unit Price</th><th>Return Qty</th><th>Condition</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {returnableItems.length === 0 ? (
                    <tr><td colSpan={9}>No returnable item found.</td></tr>
                  ) : (
                    returnableItems.map((item) => {
                      const input = returnItems.find((i) => String(i.productVariantId) === String(item.productVariantId));
                      const qty = Number(input?.quantity || 0);
                      const lineTotal = qty * Number(item.unitPrice || 0);
                      return (
                        <tr key={String(item.productVariantId)}>
                          <td><strong>{item.productNameSnapshot}</strong><div className="muted-small">{item.skuSnapshot}</div></td>
                          <td>{item.soldQty}</td>
                          <td>{item.alreadyReturned}</td>
                          <td><strong>{item.remainingQty}</strong></td>
                          <td>{money(item.unitPrice)}</td>
                          <td><input className="input mini-input" type="number" step="0.001" min="0" max={item.remainingQty} value={input?.quantity || "0"} onChange={(e) => updateReturnItem(String(item.productVariantId), { quantity: e.target.value })} disabled={item.remainingQty <= 0} /></td>
                          <td>
                            <select className="select" value={input?.condition || "resellable"} onChange={(e) => updateReturnItem(String(item.productVariantId), { condition: e.target.value as any })} disabled={item.remainingQty <= 0}>
                              <option value="resellable">Resellable</option>
                              <option value="damaged">Damaged</option>
                            </select>
                          </td>
                          <td><strong>{money(lineTotal)}</strong></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="return-submit-bar">
              <div><span>Total Return Amount</span><strong>{money(totalReturnAmount)}</strong></div>
              <button className="btn" disabled={savingReturn || totalReturnAmount <= 0}>{savingReturn ? "Saving Return..." : "Save Return"}</button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-title"><h3>Recent Returns</h3><span className="badge">{returns.length} returns</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Return No</th><th>Invoice</th><th>Customer</th><th>Warehouse</th><th>Items</th><th>Total</th><th>Method</th><th>Date</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9}>Loading...</td></tr>
              ) : returns.length === 0 ? (
                <tr><td colSpan={9}>No returns found.</td></tr>
              ) : (
                returns.map((ret) => (
                  <tr key={ret._id}>
                    <td><strong>{ret.returnNo}</strong></td>
                    <td>{ret.saleId?.invoiceNo || "-"}</td>
                    <td>{ret.customerId?.name || "-"}<div className="muted-small">{ret.customerId?.customerType || ""}</div></td>
                    <td>{ret.warehouseId?.name || "-"}</td>
                    <td>
                      {ret.items.slice(0, 2).map((item) => <div key={`${ret._id}-${item.skuSnapshot}`}>{item.productNameSnapshot} × {item.quantity} ({item.condition})</div>)}
                      {ret.items.length > 2 ? <div className="muted-small">+{ret.items.length - 2} more</div> : null}
                    </td>
                    <td>{money(ret.totalReturnAmount)}</td>
                    <td>{ret.refundMethod}</td>
                    <td>{new Date(ret.createdAt).toLocaleDateString()}</td><td><Link className="small-btn" href={`/sales-returns/${ret._id}`}>View / Print</Link></td>
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
