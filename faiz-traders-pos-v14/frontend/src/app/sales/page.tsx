"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Customer = { _id: string; name: string; customerType: string; currentBalance: number };
type Warehouse = { _id: string; name: string; type: string };
type SaleItem = { productNameSnapshot: string; skuSnapshot: string; quantity: number; salePrice: number; total: number };
type Sale = {
  _id: string; invoiceNo: string; customerId?: Customer; warehouseId?: Warehouse;
  grandTotal: number; paidAmount: number; dueAmount: number; paymentStatus: string;
  paymentMethod: string; saleType: string; createdAt: string; items: SaleItem[];
};

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(today());
  const [customerId, setCustomerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSales = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (customerId) params.set("customerId", customerId);

      const [saleRes, customerRes] = await Promise.all([
        api<{ data: Sale[] }>(`/sales?${params.toString()}`),
        api<{ data: Customer[] }>("/customers")
      ]);
      setSales(saleRes.data);
      setCustomers(customerRes.data);
    } catch (err: any) {
      setError(err.message || "Sales load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSales(); }, []);

  const totals = useMemo(() => sales.reduce((acc, sale) => {
    acc.grandTotal += Number(sale.grandTotal || 0);
    acc.paid += Number(sale.paidAmount || 0);
    acc.due += Number(sale.dueAmount || 0);
    return acc;
  }, { grandTotal: 0, paid: 0, due: 0 }), [sales]);

  return (
    <DashboardLayout title="Sales History">
      <div className="page-header">
        <div>
          <h2>Sales History</h2>
          <p>Invoices, payment status, customer khata, sale details aur printable invoice.</p>
        </div>
        <button className="btn btn-light" onClick={loadSales}>Refresh</button>
      </div>

      {error ? <div className="notice danger">{error}</div> : null}

      <div className="grid stats-grid">
        <Stat title="Invoices" value={String(sales.length)} />
        <Stat title="Total Sales" value={money(totals.grandTotal)} />
        <Stat title="Paid" value={money(totals.paid)} />
        <Stat title="Due / Khata" value={money(totals.due)} />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-title"><h3>Filters</h3><span className="badge">Sales</span></div>
        <div className="filter-row reports-filter">
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <select className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">All customers</option>
            {customers.map((customer) => (
              <option key={customer._id} value={customer._id}>{customer.name} — {customer.customerType}</option>
            ))}
          </select>
          <button className="btn" onClick={loadSales}>Apply</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-title"><h3>Invoices</h3><span className="badge">{sales.length} records</span></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Invoice</th><th>Customer</th><th>Warehouse</th><th>Items</th><th>Total</th><th>Paid / Due</th><th>Status</th><th>Date</th><th>Action</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9}>Loading...</td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={9}>No sales found.</td></tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale._id}>
                    <td><strong>{sale.invoiceNo}</strong></td>
                    <td>{sale.customerId?.name || "-"}<div className="muted-small">{sale.customerId?.customerType || ""}</div></td>
                    <td>{sale.warehouseId?.name || "-"}</td>
                    <td>
                      {sale.items.slice(0, 2).map((item) => <div key={`${sale._id}-${item.skuSnapshot}`}>{item.productNameSnapshot} × {item.quantity}</div>)}
                      {sale.items.length > 2 ? <div className="muted-small">+{sale.items.length - 2} more</div> : null}
                    </td>
                    <td>{money(sale.grandTotal)}</td>
                    <td><div>Paid: {money(sale.paidAmount)}</div><div className="muted-small">Due: {money(sale.dueAmount)}</div></td>
                    <td><span className="badge">{sale.paymentStatus}</span></td>
                    <td>{new Date(sale.createdAt).toLocaleString()}</td>
                    <td><Link className="small-btn" href={`/sales/${sale._id}`}>View / Print</Link></td>
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
  return <div className="card"><div className="stat-title">{title}</div><div className="stat-value">{value}</div></div>;
}
