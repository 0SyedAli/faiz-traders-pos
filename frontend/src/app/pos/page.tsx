"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Warehouse = { _id: string; name: string; type: string };
type Category = { _id: string; name: string };
type Customer = { _id: string; name: string; customerType: string; currentBalance: number };
type PosProduct = {
  _id: string;
  name: string;
  sku: string;
  brand?: string;
  category?: string;
  size?: string;
  gauge?: string;
  lengthFeet?: number;
  retailPrice: number;
  wholesalePrice?: number;
  distributorPrice?: number;
  dealerPrice?: number;
  salePrice: number;
  stockQty: number;
};
type CartItem = PosProduct & { quantity: number; salePrice: number; discount: number };
type Sale = { _id: string; invoiceNo: string; grandTotal: number; dueAmount: number };

const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

export default function PosPage() {
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [saleType, setSaleType] = useState("retail");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [note, setNote] = useState("");
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadBase = async () => {
    setError("");
    try {
      const [warehouseRes, categoryRes, customerRes] = await Promise.all([
        api<{ data: Warehouse[] }>("/master/warehouses"),
        api<{ data: Category[] }>("/sales/pos-categories"),
        api<{ data: Customer[] }>("/customers")
      ]);
      setWarehouses(warehouseRes.data);
      setCategories(categoryRes.data);
      setCustomers(customerRes.data);
      setWarehouseId((prev) => prev || warehouseRes.data.find((w) => w.type === "shop")?._id || warehouseRes.data[0]?._id || "");
      setCustomerId((prev) => prev || customerRes.data.find((c) => c.customerType === "walkin")?._id || customerRes.data[0]?._id || "");
    } catch (err: any) {
      setError(err.message || "POS data load failed");
    }
  };

  const loadProducts = async () => {
    if (!warehouseId) return;
    try {
      const params = new URLSearchParams();
      params.set("warehouseId", warehouseId);
      params.set("saleType", saleType);
      if (categoryId) params.set("categoryId", categoryId);
      if (search.trim()) params.set("q", search.trim());
      const res = await api<{ data: PosProduct[] }>(`/sales/pos-products?${params.toString()}`);
      setProducts(res.data);
      setSelectedIndex(0);
    } catch (err: any) {
      setError(err.message || "Product search failed");
    }
  };

  useEffect(() => { loadBase(); }, []);
  useEffect(() => {
    const timer = setTimeout(loadProducts, 120);
    return () => clearTimeout(timer);
  }, [warehouseId, categoryId, search, saleType]);
  useEffect(() => { searchRef.current?.focus(); }, []);

  const selectedCustomer = customers.find((c) => c._id === customerId);
  useEffect(() => {
    if (!selectedCustomer) return;
    if (selectedCustomer.customerType === "walkin") { setSaleType("retail"); if (paymentMethod === "credit") setPaymentMethod("cash"); }
    else if (selectedCustomer.customerType === "dealer") setSaleType("dealer");
    else if (selectedCustomer.customerType === "plumber") setSaleType("wholesale");
  }, [customerId]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + Math.max(0, item.quantity * item.salePrice - item.discount), 0);
    const grandTotal = Math.max(0, subtotal - discountAmount);
    const paid = paymentMethod === "credit" ? 0 : Math.min(paidAmount || grandTotal, grandTotal);
    const due = Math.max(0, grandTotal - paid);
    return { subtotal, grandTotal, paid, due };
  }, [cart, discountAmount, paidAmount, paymentMethod]);

  useEffect(() => {
    if (paymentMethod === "cash") setPaidAmount(totals.grandTotal);
    if (paymentMethod === "credit") setPaidAmount(0);
  }, [paymentMethod, totals.grandTotal]);

  const addProduct = (product: PosProduct) => {
    setError("");
    if (product.stockQty <= 0) { setError("This product is out of stock."); return; }
    setCart((prev) => {
      const existing = prev.find((item) => item._id === product._id);
      if (existing) {
        return prev.map((item) => item._id === product._id ? { ...item, quantity: Math.min(item.quantity + 1, product.stockQty) } : item);
      }
      return [...prev, { ...product, quantity: 1, salePrice: Number(product.salePrice || product.retailPrice || 0), discount: 0 }];
    });
    setSearch("");
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, products.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    if (event.key === "Enter") { event.preventDefault(); const item = products[selectedIndex]; if (item) addProduct(item); }
    if (event.key === "Escape") { event.preventDefault(); setSearch(""); }
  };

  const updateCart = (id: string, patch: Partial<CartItem>) => setCart((prev) => prev.map((item) => item._id === id ? { ...item, ...patch } : item));
  const removeCart = (id: string) => setCart((prev) => prev.filter((item) => item._id !== id));

  const submitSale = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(""); setError(""); setSaving(true);
    try {
      if (!cart.length) throw new Error("Cart is empty.");
      const res = await api<{ data: { sale: Sale } }>("/sales", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          warehouseId,
          saleType,
          paymentMethod,
          paidAmount: totals.paid,
          discountAmount,
          note,
          items: cart.map((item) => ({ productVariantId: item._id, quantity: item.quantity, salePrice: item.salePrice, discount: item.discount }))
        })
      });
      setLastSale(res.data.sale);
      setMessage(`Invoice saved: ${res.data.sale.invoiceNo}`);
      setCart([]); setDiscountAmount(0); setPaidAmount(0); setNote(""); await loadProducts();
      setTimeout(() => searchRef.current?.focus(), 0);
    } catch (err: any) { setError(err.message || "Sale save failed"); }
    finally { setSaving(false); }
  };

  return (
    <DashboardLayout title="POS Sale">
      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice danger">{error}</div> : null}
      <form onSubmit={submitSale} className="fast-pos">
        <div className="fast-pos-top">
          <input ref={searchRef} className="fast-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKeyDown} placeholder="Search: iron 1, elbow 1, 25 ppr, master 25, muslim, basin..." />
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>{warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select>
        </div>
        <div className="fast-pos-grid">
          <aside className="pos-cats">
            <button type="button" className={!categoryId ? "active" : ""} onClick={() => setCategoryId("")}>All Categories</button>
            {categories.map((cat) => <button type="button" key={cat._id} className={categoryId === cat._id ? "active" : ""} onClick={() => setCategoryId(cat._id)}>{cat.name}</button>)}
          </aside>
          <main className="pos-results">
            {products.length === 0 ? <div className="placeholder">No product found.</div> : products.map((product, index) => (
              <button type="button" key={product._id} className={index === selectedIndex ? "pos-result active" : "pos-result"} onClick={() => addProduct(product)}>
                <div><strong>{product.name}</strong><span>{product.category} {product.size ? ` | ${product.size}` : ""} {product.brand ? ` | ${product.brand}` : ""} {product.gauge ? ` | Gauge ${product.gauge}` : ""}</span></div>
                <div><strong>{money(product.salePrice || product.retailPrice)}</strong><span>Stock: {product.stockQty}</span></div>
              </button>
            ))}
          </main>
          <aside className="pos-cart-panel">
            <div className="cart-head"><h3>Invoice Cart</h3><button type="button" onClick={() => setCart([])}>Clear</button></div>
            <select className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>{customers.map((c) => <option key={c._id} value={c._id}>{c.name} — {c.customerType}</option>)}</select>
            <select className="select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="cash">Cash</option><option value="bank">Bank</option><option value="mixed">Mixed</option>{selectedCustomer?.customerType !== "walkin" ? <option value="credit">Credit / Khata</option> : null}</select>
            <div className="cart-items">
              {cart.map((item) => <div className="cart-line" key={item._id}><div><strong>{item.name}</strong><span>{item.size || ""}</span></div><input type="number" min="1" max={item.stockQty} value={item.quantity} onChange={(e) => updateCart(item._id, { quantity: Number(e.target.value) })} /><input type="number" value={item.salePrice} onChange={(e) => updateCart(item._id, { salePrice: Number(e.target.value) })} /><button type="button" onClick={() => removeCart(item._id)}>×</button></div>)}
            </div>
            <div className="cart-totals"><div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div><div><span>Discount</span><input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value))} /></div><div><span>Grand Total</span><strong>{money(totals.grandTotal)}</strong></div><div><span>Paid</span><input type="number" value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value))} disabled={paymentMethod === "credit"} /></div><div><span>Due</span><strong>{money(totals.due)}</strong></div></div>
            <button className="checkout-btn" disabled={saving || !cart.length}>{saving ? "Saving..." : "Checkout"}</button>
            {lastSale ? <Link className="last-invoice-link" href={`/sales/${lastSale._id}`}>Open {lastSale.invoiceNo}</Link> : null}
          </aside>
        </div>
      </form>
    </DashboardLayout>
  );
}
