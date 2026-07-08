"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type DashboardStats = {
  todaySales: number;
  todayProfit: number;
  todayPaid: number;
  todayDue: number;
  todayInvoices: number;

  monthlySales: number;
  monthlyProfit: number;
  monthlyDue: number;
  monthlyInvoices: number;

  yearlySales: number;
  yearlyInvoices: number;

  todayExpenses: number;
  monthlyExpenses: number;

  netTodayProfit: number;
  netMonthlyProfit: number;

  customerCredit: number;
  supplierPayable: number;

  customerCount: number;
  supplierCount: number;
  stockRows: number;

  lowStockCount: number;
  outOfStockCount: number;

  inventoryPurchaseValue: number;
  inventoryRetailValue: number;

  lowStock: any[];
  outOfStock: any[];
  recentSales: any[];
  recentPurchases: any[];
  recentMovements: any[];
};

const formatMoney = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const res = await api<{ data: DashboardStats }>("/dashboard");
      setStats(res.data);
    } catch (err: any) {
      setError(err.message || "Dashboard load failed");
      setStats(null);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <DashboardLayout title="Dashboard">
      <div className="page-header">
        <div>
          <h2>Business Overview</h2>
          <p>Sales, profit, khata, supplier payable, inventory aur recent activity.</p>
        </div>
        <button className="btn btn-light" onClick={load}>Refresh</button>
      </div>

      {error ? <div className="notice danger">{error}</div> : null}

      <div className="quick-actions">
        <Link href="/pos" className="quick-action">New Sale</Link>
        <Link href="/products" className="quick-action">Add Product</Link>
        <Link href="/bulk-products" className="quick-action">Bulk Import</Link>
        <Link href="/inventory" className="quick-action">Adjust Stock</Link>
        <Link href="/purchases" className="quick-action">New Purchase</Link>
        <Link href="/customers" className="quick-action">Khata</Link>
        <Link href="/expenses" className="quick-action">Expense</Link>
        <Link href="/reports" className="quick-action">Reports</Link>
      </div>

      <div className="grid stats-grid" style={{ marginTop: 18 }}>
        <Stat title="Today Sales" value={formatMoney(stats?.todaySales || 0)} />
        <Stat title="Today Profit" value={formatMoney(stats?.todayProfit || 0)} />
        <Stat title="Today Net Profit" value={formatMoney(stats?.netTodayProfit || 0)} />
        <Stat title="Today Due" value={formatMoney(stats?.todayDue || 0)} />

        <Stat title="Monthly Sales" value={formatMoney(stats?.monthlySales || 0)} />
        <Stat title="Monthly Profit" value={formatMoney(stats?.monthlyProfit || 0)} />
        <Stat title="Monthly Net Profit" value={formatMoney(stats?.netMonthlyProfit || 0)} />
        <Stat title="Monthly Expenses" value={formatMoney(stats?.monthlyExpenses || 0)} />

        <Stat title="Customer Khata" value={formatMoney(stats?.customerCredit || 0)} />
        <Stat title="Supplier Payable" value={formatMoney(stats?.supplierPayable || 0)} />
        <Stat title="Inventory Cost" value={formatMoney(stats?.inventoryPurchaseValue || 0)} />
        <Stat title="Inventory Retail" value={formatMoney(stats?.inventoryRetailValue || 0)} />

        <Stat title="Low Stock" value={String(stats?.lowStockCount || 0)} />
        <Stat title="Out of Stock" value={String(stats?.outOfStockCount || 0)} />
        <Stat title="Customers" value={String(stats?.customerCount || 0)} />
        <Stat title="Suppliers" value={String(stats?.supplierCount || 0)} />
      </div>

      <div className="two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="section-title">
            <h3>Recent Sales</h3>
            <Link className="small-btn" href="/sales">View All</Link>
          </div>
          <MiniTable
            empty="No recent sales."
            rows={(stats?.recentSales || []).map((sale: any) => ({
              a: sale.invoiceNo,
              b: sale.customerId?.name || "-",
              c: formatMoney(sale.grandTotal || 0),
              d: new Date(sale.createdAt).toLocaleDateString(),
              href: `/sales/${sale._id}`
            }))}
          />
        </div>

        <div className="card">
          <div className="section-title">
            <h3>Low Stock</h3>
            <Link className="small-btn" href="/inventory">Inventory</Link>
          </div>
          <MiniTable
            empty="No low stock."
            rows={(stats?.lowStock || []).map((row: any) => ({
              a: row.productVariantId?.name || "-",
              b: row.warehouseId?.name || "-",
              c: `${row.quantity} left`,
              d: `Alert ${row.productVariantId?.lowStockAlertQty || 0}`
            }))}
          />
        </div>

        <div className="card">
          <div className="section-title">
            <h3>Recent Purchases</h3>
            <Link className="small-btn" href="/purchases">View All</Link>
          </div>
          <MiniTable
            empty="No recent purchases."
            rows={(stats?.recentPurchases || []).map((purchase: any) => ({
              a: purchase.purchaseNo,
              b: purchase.supplierId?.name || "-",
              c: formatMoney(purchase.grandTotal || 0),
              d: new Date(purchase.createdAt).toLocaleDateString()
            }))}
          />
        </div>

        <div className="card">
          <div className="section-title">
            <h3>Recent Stock Movements</h3>
            <Link className="small-btn" href="/inventory">View All</Link>
          </div>
          <MiniTable
            empty="No stock movements."
            rows={(stats?.recentMovements || []).map((move: any) => ({
              a: move.productVariantId?.name || "-",
              b: move.warehouseId?.name || "-",
              c: `${move.type} ${move.quantity}`,
              d: new Date(move.createdAt).toLocaleDateString()
            }))}
          />
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

function MiniTable({
  rows,
  empty
}: {
  rows: { a: string; b: string; c: string; d: string; href?: string }[];
  empty: string;
}) {
  return (
    <div className="table-wrap compact-table">
      <table>
        <tbody>
          {rows.length === 0 ? (
            <tr><td>{empty}</td></tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index}>
                <td>
                  {row.href ? <Link href={row.href}><strong>{row.a}</strong></Link> : <strong>{row.a}</strong>}
                  <div className="muted-small">{row.b}</div>
                </td>
                <td>{row.c}</td>
                <td>{row.d}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
