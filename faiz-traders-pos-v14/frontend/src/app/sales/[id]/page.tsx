"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Settings = { businessName: string; phone?: string; address?: string; currency?: string };
type Sale = {
  _id: string; invoiceNo: string;
  customerId?: { name: string; phone?: string; address?: string; customerType: string; currentBalance: number };
  warehouseId?: { name: string; type: string };
  items: { productNameSnapshot: string; skuSnapshot: string; brandSnapshot?: string; sizeSnapshot?: string; unitSnapshot?: string; quantity: number; lengthPerPiece?: number; totalFeet?: number; salePrice: number; discount: number; total: number }[];
  subtotal: number; discountAmount: number; grandTotal: number; paidAmount: number; dueAmount: number;
  paymentMethod: string; paymentStatus: string; saleType: string; note?: string; createdAt: string;
};

const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

export default function SaleInvoicePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [sale, setSale] = useState<Sale | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    if (!id || id === "undefined") {
      setError("Invalid sale invoice id.");
      return;
    }

    setError("");
    try {
      const [saleRes, settingsRes] = await Promise.all([
        api<{ data: Sale }>(`/sales/${id}`),
        api<{ data: Settings }>("/settings")
      ]);
      setSale(saleRes.data);
      setSettings(settingsRes.data);
    } catch (err: any) {
      setError(err.message || "Invoice load failed");
    }
  };

  useEffect(() => { load(); }, [id]);

  return (
    <DashboardLayout title="Sale Invoice">
      <div className="page-header no-print">
        <div><h2>Invoice Detail</h2><p>Sale invoice detail aur printable A4 invoice.</p></div>
        <div className="row-actions">
          <Link className="btn btn-light" href="/sales">Back</Link>
          <button className="btn" onClick={() => window.print()} disabled={!sale}>Print Invoice</button>
        </div>
      </div>

      {error ? <div className="notice danger no-print">{error}</div> : null}

      {!sale ? (
        <div className="card">Loading invoice...</div>
      ) : (
        <div className="invoice-paper">
          <div className="invoice-header">
            <div>
              <h1>{settings?.businessName || "Faiz Traders"}</h1>
              <p>{settings?.address || ""}</p>
              <p>{settings?.phone || ""}</p>
            </div>
            <div className="invoice-meta">
              <h2>Invoice</h2>
              <p><strong>{sale.invoiceNo}</strong></p>
              <p>{new Date(sale.createdAt).toLocaleString()}</p>
            </div>
          </div>

          <div className="invoice-grid">
            <div>
              <span>Customer</span>
              <strong>{sale.customerId?.name || "Walk-in Customer"}</strong>
              <p>{sale.customerId?.phone || ""}</p>
              <p>{sale.customerId?.address || ""}</p>
            </div>
            <div>
              <span>Sale Info</span>
              <strong>{sale.saleType}</strong>
              <p>Payment: {sale.paymentMethod}</p>
              <p>Warehouse: {sale.warehouseId?.name || "-"}</p>
            </div>
          </div>

          <table className="invoice-table">
            <thead><tr><th>#</th><th>Item</th><th>SKU</th><th>Size</th><th>Qty</th><th>Rate</th><th>Disc.</th><th>Total</th></tr></thead>
            <tbody>
              {sale.items.map((item, index) => (
                <tr key={`${item.skuSnapshot}-${index}`}>
                  <td>{index + 1}</td>
                  <td><strong>{item.productNameSnapshot}</strong><div className="muted-small">{item.brandSnapshot || ""} {item.totalFeet ? `• ${item.totalFeet} ft` : ""}</div></td>
                  <td>{item.skuSnapshot}</td>
                  <td>{item.sizeSnapshot || "-"}</td>
                  <td>{item.quantity} {item.unitSnapshot || ""}</td>
                  <td>{money(item.salePrice)}</td>
                  <td>{money(item.discount)}</td>
                  <td><strong>{money(item.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="invoice-bottom">
            <div className="invoice-note"><h4>Note</h4><p>{sale.note || "Thank you for your business."}</p></div>
            <div className="invoice-totals">
              <div><span>Subtotal</span><strong>{money(sale.subtotal)}</strong></div>
              <div><span>Discount</span><strong>{money(sale.discountAmount)}</strong></div>
              <div><span>Grand Total</span><strong>{money(sale.grandTotal)}</strong></div>
              <div><span>Paid</span><strong>{money(sale.paidAmount)}</strong></div>
              <div><span>Due</span><strong>{money(sale.dueAmount)}</strong></div>
            </div>
          </div>

          <div className="invoice-footer"><p>Generated by Faiz Traders</p></div>
        </div>
      )}
    </DashboardLayout>
  );
}
