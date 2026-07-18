"use client";

import Link from "next/link";
import Decimal from "decimal.js";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { offlineDb } from "@/lib/offline-db";
import { createOfflineSale } from "@/lib/offline-sales";
import { FastProductSearch } from "@/lib/local-search";
import { runSyncCycle } from "@/lib/sync-engine";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addItem, clearCart, removeItem, updateItem, type PosCartItem } from "@/store/slices/cartSlice";
import type { LocalCategory, LocalCustomer, LocalProduct, LocalSale, LocalWarehouse } from "@/types/offline";

const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

const priceForSaleType = (product: LocalProduct, saleType: string) => {
  if (saleType === "wholesale" && product.wholesalePrice > 0) return product.wholesalePrice;
  if (saleType === "dealer" && (product.distributorPrice || product.dealerPrice) > 0) return product.distributorPrice || product.dealerPrice;
  if (saleType === "plumber" && product.wholesalePrice > 0) return product.wholesalePrice;
  return product.retailPrice;
};

export default function PosPage() {
  const dispatch = useAppDispatch();
  const cart = useAppSelector((state) => state.cart.items);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [warehouses, setWarehouses] = useState<LocalWarehouse[]>([]);
  const [categories, setCategories] = useState<LocalCategory[]>([]);
  const [customers, setCustomers] = useState<LocalCustomer[]>([]);
  const [warehouseProducts, setWarehouseProducts] = useState<LocalProduct[]>([]);
  const [products, setProducts] = useState<Array<LocalProduct & { salePrice: number }>>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [saleType, setSaleType] = useState("retail");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [note, setNote] = useState("");
  const [lastSale, setLastSale] = useState<LocalSale | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const searchEngine = useMemo(() => new FastProductSearch(warehouseProducts), [warehouseProducts]);

  const loadBase = async () => {
    const [localWarehouses, localCategories, localCustomers] = await Promise.all([
      offlineDb.warehouses.toArray(),
      offlineDb.categories.orderBy("name").toArray(),
      offlineDb.customers.where("status").equals("active").toArray(),
    ]);

    setWarehouses(localWarehouses);
    setCategories(localCategories);
    setCustomers(localCustomers);
    setWarehouseId((previous) => previous || localWarehouses.find((row) => row.type === "shop")?.id || localWarehouses[0]?.id || "");
    setCustomerId((previous) => previous || localCustomers.find((row) => row.customerType === "walkin")?.id || localCustomers[0]?.id || "");
  };

  const loadWarehouseProducts = async () => {
    if (!warehouseId) return setWarehouseProducts([]);
    setWarehouseProducts(await offlineDb.products.where("warehouseId").equals(warehouseId).filter((row) => row.status === "active").toArray());
  };

  useEffect(() => {
    void loadBase();
    const handler = () => { void loadBase(); void loadWarehouseProducts(); };
    window.addEventListener("my-store-offline-data-updated", handler);
    return () => window.removeEventListener("my-store-offline-data-updated", handler);
  }, [warehouseId]);

  useEffect(() => { void loadWarehouseProducts(); }, [warehouseId]);

  useEffect(() => {
    const result = searchEngine.search(search, categoryId).map((product) => ({ ...product, salePrice: priceForSaleType(product, saleType) }));
    setProducts(result);
    setSelectedIndex(0);
  }, [searchEngine, search, categoryId, saleType]);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  useEffect(() => {
    if (!selectedCustomer) return;
    if (selectedCustomer.customerType === "walkin") {
      setSaleType("retail");
      if (paymentMethod === "credit") setPaymentMethod("cash");
    } else if (selectedCustomer.customerType === "dealer") setSaleType("dealer");
    else if (selectedCustomer.customerType === "plumber") setSaleType("wholesale");
  }, [customerId, selectedCustomer, paymentMethod]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum.plus(Decimal.max(0, new Decimal(item.quantity).mul(item.salePrice).minus(item.discount))), new Decimal(0));
    const grandTotal = Decimal.max(0, subtotal.minus(discountAmount || 0));
    const paid = paymentMethod === "credit" ? new Decimal(0) : Decimal.min(new Decimal(paidAmount || grandTotal), grandTotal);
    return { subtotal: subtotal.toNumber(), grandTotal: grandTotal.toNumber(), paid: paid.toNumber(), due: Decimal.max(0, grandTotal.minus(paid)).toNumber() };
  }, [cart, discountAmount, paidAmount, paymentMethod]);

  useEffect(() => {
    if (paymentMethod === "cash") setPaidAmount(totals.grandTotal);
    if (paymentMethod === "credit") setPaidAmount(0);
  }, [paymentMethod, totals.grandTotal]);

  const addProductToCart = (product: LocalProduct & { salePrice: number }) => {
    setError("");
    if (product.stockQty <= 0) return setError("This product is out of stock.");
    dispatch(addItem({
      _id: product.serverId,
      name: product.name,
      sku: product.sku,
      brand: product.brand,
      category: product.category,
      size: product.size,
      gauge: product.gauge,
      lengthFeet: product.lengthFeet,
      purchasePrice: product.purchasePrice,
      retailPrice: product.retailPrice,
      wholesalePrice: product.wholesalePrice,
      distributorPrice: product.distributorPrice,
      dealerPrice: product.dealerPrice,
      salePrice: product.salePrice,
      stockQty: product.stockQty,
    }));
    setSearch("");
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setSelectedIndex((index) => Math.min(index + 1, products.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setSelectedIndex((index) => Math.max(index - 1, 0)); }
    if (event.key === "Enter") { event.preventDefault(); const product = products[selectedIndex]; if (product) addProductToCart(product); }
    if (event.key === "Escape") { event.preventDefault(); setSearch(""); }
  };

  const submitSale = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setMessage(""); setError(""); setSaving(true);

    try {
      const sale = await createOfflineSale({
        customerId,
        warehouseId,
        saleType,
        paymentMethod,
        paidAmount: totals.paid,
        discountAmount,
        note,
        items: cart.map((item) => ({ productVariantId: item._id, quantity: item.quantity, salePrice: item.salePrice, discount: item.discount })),
      });

      setLastSale(sale);
      setMessage(`Invoice saved locally: ${sale.invoiceNo}`);
      dispatch(clearCart());
      setDiscountAmount(0); setPaidAmount(0); setNote("");
      await loadWarehouseProducts();
      void runSyncCycle(false);
      window.setTimeout(() => searchRef.current?.focus(), 0);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Sale save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="POS Sale">
      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice danger">{error}</div> : null}
      {!warehouses.length ? <div className="notice danger">Local database is empty. Connect internet once and click the sync status button.</div> : null}
      <form onSubmit={submitSale} className="fast-pos">
        <div className="fast-pos-top">
          <input ref={searchRef} className="fast-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={onSearchKeyDown} placeholder="Instant local search: iron 1, elbow 1, 25 ppr, master 25..." />
          <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select>
        </div>
        <div className="fast-pos-grid">
          <aside className="pos-cats">
            <button type="button" className={!categoryId ? "active" : ""} onClick={() => setCategoryId("")}>All Categories</button>
            {categories.map((category) => <button type="button" key={category.id} className={categoryId === category.id ? "active" : ""} onClick={() => setCategoryId(category.id)}>{category.name}</button>)}
          </aside>
          <main className="pos-results">
            {products.length === 0 ? <div className="placeholder">No product found in local database.</div> : products.map((product, index) => (
              <button type="button" key={product.id} className={index === selectedIndex ? "pos-result active" : "pos-result"} onClick={() => addProductToCart(product)}>
                <div><strong>{product.name}</strong><span>{product.category}{product.size ? ` | ${product.size}` : ""}{product.brand ? ` | ${product.brand}` : ""}{product.gauge ? ` | Gauge ${product.gauge}` : ""}</span></div>
                <div><strong>{money(product.salePrice)}</strong><span>Stock: {product.stockQty}</span></div>
              </button>
            ))}
          </main>
          <aside className="pos-cart-panel">
            <div className="cart-head"><h3>Invoice Cart</h3><button type="button" onClick={() => dispatch(clearCart())}>Clear</button></div>
            <select className="select" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} — {customer.customerType}</option>)}</select>
            <select className="select" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Cash</option><option value="bank">Bank</option><option value="mixed">Mixed</option>{selectedCustomer?.customerType !== "walkin" ? <option value="credit">Credit / Khata</option> : null}</select>
            <div className="cart-items">
              {cart.map((item: PosCartItem) => <div className="cart-line" key={item._id}><div><strong>{item.name}</strong><span>{item.size || ""}</span></div><input type="number" min="0.001" step="0.001" max={item.stockQty} value={item.quantity} onChange={(event) => dispatch(updateItem({ id: item._id, patch: { quantity: Number(event.target.value) } }))} /><input type="number" step="0.01" value={item.salePrice} onChange={(event) => dispatch(updateItem({ id: item._id, patch: { salePrice: Number(event.target.value) } }))} /><button type="button" onClick={() => dispatch(removeItem(item._id))}>×</button></div>)}
            </div>
            <div className="cart-totals"><div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div><div><span>Discount</span><input type="number" value={discountAmount} onChange={(event) => setDiscountAmount(Number(event.target.value))} /></div><div><span>Grand Total</span><strong>{money(totals.grandTotal)}</strong></div><div><span>Paid</span><input type="number" value={paidAmount} onChange={(event) => setPaidAmount(Number(event.target.value))} disabled={paymentMethod === "credit"} /></div><div><span>Due</span><strong>{money(totals.due)}</strong></div></div>
            <button className="checkout-btn" disabled={saving || !cart.length}>{saving ? "Saving Locally..." : "Checkout"}</button>
            {lastSale ? <Link className="last-invoice-link" href={`/offline-sales/${lastSale.id}`}>Open {lastSale.invoiceNo}</Link> : null}
          </aside>
        </div>
      </form>
    </DashboardLayout>
  );
}
