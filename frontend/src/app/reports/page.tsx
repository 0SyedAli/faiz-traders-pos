"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Summary = {
  sales: {
    count: number;
    total: number;
    paid: number;
    due: number;
    profit: number;
  };
  purchases: {
    count: number;
    total: number;
    paid: number;
    due: number;
  };
  expenses: {
    count: number;
    total: number;
  };
  netProfit: number;
  customerCredit: number;
  supplierPayable: number;
  inventory: {
    purchaseValue: number;
    retailValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
};

type ExpenseCategoryReport = {
  categoryId: string;
  categoryName: string;
  total: number;
  count: number;
};

type StockRow = {
  _id: string;
  warehouseId?: { name: string; type: string };
  productVariantId?: {
    name: string;
    sku: string;
    purchasePrice: number;
    retailPrice: number;
    lowStockAlertQty: number;
    saleUnit: string;
    brandId?: { name: string };
    sizeId?: { name: string };
  };
  quantity: number;
};

type Movement = {
  _id: string;
  warehouseId?: { name: string; type: string };
  productVariantId?: { name: string; sku: string };
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  note?: string;
  createdAt: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

export default function ReportsPage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());

  const [summary, setSummary] = useState<Summary | null>(null);
  const [expensesByCategory, setExpensesByCategory] = useState<ExpenseCategoryReport[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("from", from);
      params.set("to", to);

      const [summaryRes, expenseRes, stockRes, movementRes] = await Promise.all([
        api<{ data: Summary }>(`/reports/summary?${params.toString()}`),
        api<{ data: ExpenseCategoryReport[] }>(`/reports/expenses-by-category?${params.toString()}`),
        api<{ data: StockRow[] }>("/reports/top-stock"),
        api<{ data: Movement[] }>(`/reports/stock-movements?${params.toString()}`)
      ]);

      setSummary(summaryRes.data);
      setExpensesByCategory(expenseRes.data);
      setStockRows(stockRes.data);
      setMovements(movementRes.data);
    } catch (err: any) {
      setError(err.message || "Reports load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  return (
    <DashboardLayout title="Reports">
      <div className="page-header">
        <div>
          <h2>Reports</h2>
          <p>Sales, purchases, expenses, profit/loss, khata, payable aur inventory valuation.</p>
        </div>

        <button className="btn btn-light" onClick={loadReports}>
          Refresh
        </button>
      </div>

      {error ? <div className="notice danger">{error}</div> : null}

      <div className="card">
        <div className="section-title">
          <h3>Date Range</h3>
          <span className="badge">Report Filter</span>
        </div>

        <div className="filter-row reports-filter">
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn" onClick={loadReports}>Apply</button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ marginTop: 18 }}>Loading reports...</div>
      ) : (
        <>
          <div className="grid stats-grid" style={{ marginTop: 18 }}>
            <Stat title="Sales" value={money(summary?.sales.total || 0)} />
            <Stat title="Gross Profit" value={money(summary?.sales.profit || 0)} />
            <Stat title="Expenses" value={money(summary?.expenses.total || 0)} />
            <Stat title="Net Profit" value={money(summary?.netProfit || 0)} />
            <Stat title="Purchases" value={money(summary?.purchases.total || 0)} />
            <Stat title="Purchase Due" value={money(summary?.purchases.due || 0)} />
            <Stat title="Customer Khata" value={money(summary?.customerCredit || 0)} />
            <Stat title="Supplier Payable" value={money(summary?.supplierPayable || 0)} />
            <Stat title="Inventory Cost Value" value={money(summary?.inventory.purchaseValue || 0)} />
            <Stat title="Inventory Retail Value" value={money(summary?.inventory.retailValue || 0)} />
            <Stat title="Low Stock" value={String(summary?.inventory.lowStockCount || 0)} />
            <Stat title="Out of Stock" value={String(summary?.inventory.outOfStockCount || 0)} />
          </div>

          <div className="two-column" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="section-title">
                <h3>Expenses by Category</h3>
                <span className="badge">{expensesByCategory.length} categories</span>
              </div>

              <div className="table-wrap compact-table">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Entries</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expensesByCategory.length === 0 ? (
                      <tr><td colSpan={3}>No expenses found.</td></tr>
                    ) : (
                      expensesByCategory.map((row) => (
                        <tr key={row.categoryId}>
                          <td>{row.categoryName}</td>
                          <td>{row.count}</td>
                          <td><strong>{money(row.total)}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="section-title">
                <h3>Low / Critical Stock</h3>
                <span className="badge">{stockRows.length} rows</span>
              </div>

              <div className="table-wrap compact-table">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Warehouse</th>
                      <th>Qty</th>
                      <th>Alert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockRows.length === 0 ? (
                      <tr><td colSpan={4}>No stock records.</td></tr>
                    ) : (
                      stockRows.slice(0, 15).map((row) => {
                        const variant = row.productVariantId;
                        return (
                          <tr key={row._id}>
                            <td>
                              <strong>{variant?.name || "-"}</strong>
                              <div className="muted-small">{variant?.sku || "-"}</div>
                            </td>
                            <td>{row.warehouseId?.name || "-"}</td>
                            <td>{row.quantity}</td>
                            <td>{variant?.lowStockAlertQty || 0}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="section-title">
              <h3>Stock Movement Report</h3>
              <span className="badge">{movements.length} movements</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item</th>
                    <th>Warehouse</th>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Stock</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr><td colSpan={7}>No movements found in selected range.</td></tr>
                  ) : (
                    movements.map((movement) => (
                      <tr key={movement._id}>
                        <td>{new Date(movement.createdAt).toLocaleDateString()}</td>
                        <td>
                          <strong>{movement.productVariantId?.name || "-"}</strong>
                          <div className="muted-small">{movement.productVariantId?.sku || "-"}</div>
                        </td>
                        <td>{movement.warehouseId?.name || "-"}</td>
                        <td>{movement.type}</td>
                        <td>{movement.quantity}</td>
                        <td>{movement.previousStock} → {movement.newStock}</td>
                        <td>{movement.note || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
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
