"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { offlineDb } from "@/lib/offline-db";
import type { LocalSale } from "@/types/offline";

const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

export default function OfflineSalesPage() {
  const [sales, setSales] = useState<LocalSale[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => setSales((await offlineDb.sales.orderBy("createdAt").reverse().toArray()));

  useEffect(() => {
    void load();
    const handler = () => void load();
    window.addEventListener("my-store-offline-data-updated", handler);
    return () => window.removeEventListener("my-store-offline-data-updated", handler);
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sales;
    return sales.filter((sale) => [sale.invoiceNo, sale.customerName, sale.paymentMethod, sale.syncStatus].join(" ").toLowerCase().includes(query));
  }, [sales, search]);

  return (
    <DashboardLayout title="Local Sales">
      <div className="page-header">
        <div><h2>Local Offline Sales</h2><p>These invoices remain available without internet and sync automatically.</p></div>
      </div>
      <div className="card">
        <div className="filter-row"><input className="input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice or customer" /></div>
        <div className="table-wrap">
          <table><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Total</th><th>Paid</th><th>Due</th><th>Sync</th><th /></tr></thead>
          <tbody>{filtered.length ? filtered.map((sale) => <tr key={sale.id}>
            <td><strong>{sale.invoiceNo}</strong></td><td>{new Date(sale.createdAt).toLocaleString()}</td><td>{sale.customerName}</td><td>{money(sale.grandTotal)}</td><td>{money(sale.paidAmount)}</td><td>{money(sale.dueAmount)}</td><td><span className={`sync-pill ${sale.syncStatus}`}>{sale.syncStatus}</span></td><td><Link className="small-btn" href={`/offline-sales/${sale.id}`}>Open</Link></td>
          </tr>) : <tr><td colSpan={8}>No local sales found.</td></tr>}</tbody></table>
        </div>
      </div>
    </DashboardLayout>
  );
}
