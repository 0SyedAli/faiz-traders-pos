"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { offlineDb } from "@/lib/offline-db";
import type { LocalSale, LocalSaleItem } from "@/types/offline";

const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

export default function OfflineSaleDetailPage() {
  const params = useParams<{ id: string }>();
  const [sale, setSale] = useState<LocalSale | null>(null);
  const [items, setItems] = useState<LocalSaleItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const row = await offlineDb.sales.get(params.id);
      setSale(row || null);
      setItems(await offlineDb.saleItems.where("saleId").equals(params.id).toArray());
    };
    void load();
  }, [params.id]);

  return (
    <DashboardLayout title="Local Invoice">
      {!sale ? <div className="card">Invoice not found.</div> : <div className="thermal-receipt-wrap">
        <div className="receipt-actions"><button className="btn" onClick={() => window.print()}>Print 80mm Receipt</button></div>
        <article className="thermal-receipt">
          <header><h2>Faiz Traders</h2><p>Offline POS Receipt</p><p>{sale.invoiceNo}</p><p>{new Date(sale.createdAt).toLocaleString()}</p></header>
          <div className="receipt-line"><span>Customer</span><strong>{sale.customerName}</strong></div>
          <div className="receipt-divider" />
          {items.map((item) => <div className="receipt-item" key={item.id}><strong>{item.productNameSnapshot}</strong><div><span>{item.quantity} × {money(item.salePrice)}</span><b>{money(item.total)}</b></div></div>)}
          <div className="receipt-divider" />
          <div className="receipt-line"><span>Subtotal</span><strong>{money(sale.subtotal)}</strong></div>
          <div className="receipt-line"><span>Discount</span><strong>{money(sale.discountAmount)}</strong></div>
          <div className="receipt-line receipt-total"><span>Total</span><strong>{money(sale.grandTotal)}</strong></div>
          <div className="receipt-line"><span>Paid</span><strong>{money(sale.paidAmount)}</strong></div>
          <div className="receipt-line"><span>Due</span><strong>{money(sale.dueAmount)}</strong></div>
          <div className="receipt-line"><span>Payment</span><strong>{sale.paymentMethod}</strong></div>
          <footer><p>Thank you</p><small>Sync status: {sale.syncStatus}</small></footer>
        </article>
      </div>}
    </DashboardLayout>
  );
}
