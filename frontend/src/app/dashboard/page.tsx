"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type DashboardStats = {
  todaySales: number;
  todayProfit: number;
  monthlySales: number;
  yearlySales: number;
  todayExpenses: number;
  monthlyExpenses: number;
  customerCredit: number;
  supplierPayable: number;
  lowStockCount: number;
  outOfStockCount: number;
};

const formatMoney = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api<{ data: DashboardStats }>("/dashboard")
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, []);

  return (
    <DashboardLayout title="Dashboard">
      <div className="grid stats-grid">
        <Stat title="Today Sales" value={formatMoney(stats?.todaySales || 0)} />
        <Stat title="Today Profit" value={formatMoney(stats?.todayProfit || 0)} />
        <Stat title="Monthly Sales" value={formatMoney(stats?.monthlySales || 0)} />
        <Stat title="Yearly Sales" value={formatMoney(stats?.yearlySales || 0)} />
        <Stat title="Today Expenses" value={formatMoney(stats?.todayExpenses || 0)} />
        <Stat title="Monthly Expenses" value={formatMoney(stats?.monthlyExpenses || 0)} />
        <Stat title="Customer Khata" value={formatMoney(stats?.customerCredit || 0)} />
        <Stat title="Supplier Payable" value={formatMoney(stats?.supplierPayable || 0)} />
        <Stat title="Low Stock" value={String(stats?.lowStockCount || 0)} />
        <Stat title="Out of Stock" value={String(stats?.outOfStockCount || 0)} />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>Next Build Steps</h3>
        <p className="placeholder">
          Ab next pages me product form, warehouse stock adjustment, POS cart,
          plumber khata sale, purchases, returns aur reports connect karenge.
        </p>
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
