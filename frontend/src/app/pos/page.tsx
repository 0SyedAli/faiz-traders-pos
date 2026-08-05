"use client";

import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KbdHint } from "@/components/KbdHint";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { offlineDb } from "@/lib/offline-db";
import { createOfflineSale } from "@/lib/offline-sales";
import { FastProductSearch } from "@/lib/local-search";
import { runSyncCycle } from "@/lib/sync-engine";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addItem, clearCart, removeItem, updateItem, type PosCartItem } from "@/store/slices/cartSlice";
import type { LocalCategory, LocalCustomer, LocalProduct, LocalWarehouse } from "@/types/offline";

const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

const priceForSaleType = (product: LocalProduct, saleType: string) => {
  if (saleType && product.salePrices?.[saleType] !== undefined) return product.salePrices[saleType];
  if (saleType === "wholesale" && product.wholesalePrice > 0) return product.wholesalePrice;
  if (saleType === "dealer" && (product.distributorPrice || product.dealerPrice) > 0) return product.distributorPrice || product.dealerPrice;
  return product.retailPrice;
};

export default function PosPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const cart = useAppSelector((state) => state.cart.items);

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const searchRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);          // product list container
  const customerRef = useRef<HTMLSelectElement | null>(null);   // Alt+U
  const paymentRef = useRef<HTMLSelectElement | null>(null);   // Alt+M
  const saleTypeRef = useRef<HTMLSelectElement | null>(null);   // Alt+T
  const discountRef = useRef<HTMLInputElement | null>(null);    // Alt+D
  const paidRef = useRef<HTMLInputElement | null>(null);    // Alt+A
  const catsRef = useRef<HTMLElement | null>(null);         // category sidebar (for scroll)

  // ── State ─────────────────────────────────────────────────────────────────
  const [warehouses, setWarehouses] = useState<LocalWarehouse[]>([]);
  const [categories, setCategories] = useState<LocalCategory[]>([]);
  const [customers, setCustomers] = useState<LocalCustomer[]>([]);
  const [saleTypes, setSaleTypes] = useState([{ key: "retail", name: "Retail" }]);
  const [saleType, setSaleType] = useState("retail");
  const [warehouseProducts, setWarehouseProducts] = useState<LocalProduct[]>([]);
  const [products, setProducts] = useState<Array<LocalProduct & { salePrice: number }>>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);   // highlighted product
  const [selectedCartIdx, setSelectedCartIdx] = useState(0);   // highlighted cart item
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  const searchEngine = useMemo(() => new FastProductSearch(warehouseProducts), [warehouseProducts]);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadBase = async () => {
    const [localWarehouses, localCategories, localCustomers, localSettings] = await Promise.all([
      offlineDb.warehouses.toArray(),
      offlineDb.categories.orderBy("name").toArray(),
      offlineDb.customers.where("status").equals("active").toArray(),
      offlineDb.settings.get("business"),
    ]);
    setWarehouses(localWarehouses);
    setCategories(localCategories);
    setCustomers(localCustomers);
    const configuredSaleTypes = (localSettings?.value as { saleTypes?: Array<{ key: string; name: string }> } | undefined)?.saleTypes;
    setSaleTypes(configuredSaleTypes?.length ? configuredSaleTypes : [{ key: "retail", name: "Retail" }, { key: "wholesale", name: "Wholesale" }]);
    setSaleType((previous) => {
      if (configuredSaleTypes?.some((type) => type.key === previous)) return previous;
      return configuredSaleTypes?.[0]?.key || "retail";
    });
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

  // ── Auto-scroll active product into view ──────────────────────────────────
  useEffect(() => {
    if (!resultsRef.current) return;
    const activeBtn = resultsRef.current.querySelector<HTMLButtonElement>("[data-pos-result='true'].active");
    activeBtn?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  // ── Auto-scroll active cart item into view ────────────────────────────────
  useEffect(() => {
    const activeRow = document.querySelector<HTMLDivElement>("[data-cart-row='true'].cart-line-active");
    activeRow?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedCartIdx]);

  // ── Clamp selectedCartIdx when cart changes ───────────────────────────────
  useEffect(() => {
    setSelectedCartIdx((i) => Math.min(i, Math.max(0, cart.length - 1)));
  }, [cart.length]);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  useEffect(() => {
    if (selectedCustomer?.customerType === "walkin" && paymentMethod === "credit") {
      setPaymentMethod("cash");
    }
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

  // ── Category helpers ──────────────────────────────────────────────────────
  /** All category IDs including "" (All) at index 0 */
  const allCategoryIds = useMemo(() => ["", ...categories.map((c) => c.id)], [categories]);

  const cycleCategory = useCallback((direction: 1 | -1) => {
    setCategoryId((current) => {
      const idx = allCategoryIds.indexOf(current);
      const nextIdx = (idx + direction + allCategoryIds.length) % allCategoryIds.length;
      return allCategoryIds[nextIdx];
    });
    // scroll the active category button into view
    window.setTimeout(() => {
      catsRef.current?.querySelector<HTMLButtonElement>(".active")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 30);
  }, [allCategoryIds]);

  // ── Cart helpers ──────────────────────────────────────────────────────────
  const addProductToCart = (product: LocalProduct & { salePrice: number }) => {
    setError("");
    if (!saleType) return setError("Select a sale type before adding products.");
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
    // New item is always pushed to the end — select it
    setSelectedCartIdx(cart.length); // cart.length before dispatch = new last index
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  /** Change quantity of the currently selected cart item by `delta`. */
  const changeSelectedCartQty = useCallback((delta: 1 | -1) => {
    const item = cart[selectedCartIdx];
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty < 1) {
      dispatch(removeItem(item._id));
    } else if (newQty <= item.stockQty) {
      dispatch(updateItem({ id: item._id, patch: { quantity: newQty } }));
    }
  }, [cart, selectedCartIdx, dispatch]);

  /** Remove the currently selected cart item. */
  const removeSelectedCartItem = useCallback(() => {
    const item = cart[selectedCartIdx];
    if (item) dispatch(removeItem(item._id));
  }, [cart, selectedCartIdx, dispatch]);

  // ── Search input keyboard handler ─────────────────────────────────────────
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setSelectedIndex((index) => Math.min(index + 1, products.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setSelectedIndex((index) => Math.max(index - 1, 0)); }
    if (event.key === "Enter") { event.preventDefault(); const product = products[selectedIndex]; if (product) addProductToCart(product); }
    if (event.key === "Escape") { event.preventDefault(); setSearch(""); }
  };

  // ── Shortcut action callbacks ─────────────────────────────────────────────
  /** Reset the entire POS session — new sale.
   *  Alt+N in DashboardLayout handles the cross-page router.push("/pos").
   *  This local version just clears state when already on /pos. */
  const handleNewSale = useCallback(() => {
    dispatch(clearCart());
    setDiscountAmount(0);
    setPaidAmount(0);
    setNote("");
    setSearch("");
    setError("");
    setMessage("");
    setSelectedCartIdx(0);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [dispatch]);

  const handleFocusSearch = useCallback(() => {
    searchRef.current?.focus();
    searchRef.current?.select();
  }, []);

  const handleCheckout = useCallback(() => { formRef.current?.requestSubmit(); }, []);
  const handleClearCart = useCallback(() => { dispatch(clearCart()); }, [dispatch]);

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  useKeyboardShortcuts([
    // ── Core POS ──────────────────────────────────────────────────────────
    { key: "n", alt: true, handler: handleNewSale },        // Alt+N — New sale / clear
    { key: "s", alt: true, handler: handleFocusSearch },    // Alt+S — Focus search
    { key: "/", handler: handleFocusSearch },    // /     — Focus search (outside input)
    { key: "c", alt: true, handler: handleCheckout },       // Alt+C — Checkout
    { key: "x", alt: true, handler: handleClearCart },      // Alt+X — Clear cart
    { key: "?", shift: true, handler: () => setShowHelp(true) }, // ? — Help
    { key: "h", alt: true, handler: () => setShowHelp(true) },   // Alt+H — Help

    // ── Product navigation ────────────────────────────────────────────────
    { key: "ArrowDown", alt: true, handler: () => setSelectedIndex((i) => Math.min(i + 1, products.length - 1)) },
    { key: "ArrowUp", alt: true, handler: () => setSelectedIndex((i) => Math.max(i - 1, 0)) },
    { key: "Enter", alt: true, handler: () => { const p = products[selectedIndex]; if (p) addProductToCart(p); } },

    // ── Category cycling ──────────────────────────────────────────────────
    // Alt+] → next category   Alt+[ → previous category
    { key: "]", alt: true, handler: () => cycleCategory(1) },
    { key: "[", alt: true, handler: () => cycleCategory(-1) },

    // ── Cart panel field focus ────────────────────────────────────────────
    { key: "u", alt: true, handler: () => { customerRef.current?.focus(); } },    // Alt+U — Customer
    { key: "m", alt: true, handler: () => { paymentRef.current?.focus(); } },     // Alt+M — Payment Method
    { key: "t", alt: true, handler: () => { saleTypeRef.current?.focus(); } },    // Alt+T — Sale Type
    { key: "d", alt: true, handler: () => { discountRef.current?.focus(); discountRef.current?.select(); } }, // Alt+D — Discount
    { key: "a", alt: true, handler: () => { paidRef.current?.focus(); paidRef.current?.select(); } },         // Alt+A — Paid Amount

    // ── Cart item navigation & editing ────────────────────────────────────
    // Alt+PageDown / Alt+PageUp → move between cart items
    { key: "PageDown", alt: true, handler: () => setSelectedCartIdx((i) => Math.min(i + 1, cart.length - 1)) },
    { key: "PageUp", alt: true, handler: () => setSelectedCartIdx((i) => Math.max(i - 1, 0)) },
    // Alt+= / Alt++ → increment qty of selected cart item
    { key: "=", alt: true, handler: () => changeSelectedCartQty(1) },
    { key: "+", alt: true, handler: () => changeSelectedCartQty(1) },
    // Alt+- → decrement qty (reaches 0 → removes item)
    { key: "-", alt: true, handler: () => changeSelectedCartQty(-1) },
    // Alt+Delete / Alt+Backspace → remove selected cart item
    { key: "Delete", alt: true, handler: removeSelectedCartItem },
    { key: "Backspace", alt: true, handler: removeSelectedCartItem },
  ]);

  // ── Form submit ───────────────────────────────────────────────────────────
  const submitSale = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setMessage(""); setError(""); setSaving(true);
    try {
      if (!saleType) throw new Error("Please select a sale type.");
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
      dispatch(clearCart());
      setDiscountAmount(0); setPaidAmount(0); setNote("");
      await loadWarehouseProducts();
      void runSyncCycle(false);
      router.push(`/offline-sales/${sale.id}`);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Sale save failed");
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout title="POS Sale">
      <KeyboardShortcutsModal open={showHelp} onClose={() => setShowHelp(false)} />

      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice danger">{error}</div> : null}
      {!warehouses.length ? <div className="notice danger">Local database is empty. Connect internet once and click the sync status button.</div> : null}

      <form ref={formRef} onSubmit={submitSale} className="fast-pos">

        {/* ── Top Bar: Search + Warehouse ───────────────────────────────── */}
        <div className="fast-pos-top">
          <div className="fast-search-wrap">
            <input
              id="pos-search"
              ref={searchRef}
              className="fast-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Instant local search: iron 1, elbow 1, 25 ppr, master 25..."
              aria-label="Product search"
              autoComplete="off"
            />
            <span className="fast-search-hints">
              <KbdHint keys="Alt+S" /> <KbdHint keys="/" />
            </span>
          </div>
          <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
          </select>
        </div>

        <div className="fast-pos-grid">

          {/* ── Categories Sidebar ────────────────────────────────────────── */}
          <aside ref={catsRef} className="pos-cats" aria-label="Product categories">
            <div className="pos-cats-head">
              <span>Categories</span>
              <span className="pos-cats-hint"><KbdHint keys="Alt+[" /> <KbdHint keys="Alt+]" /></span>
            </div>
            <button
              type="button"
              className={!categoryId ? "active" : ""}
              onClick={() => setCategoryId("")}
            >
              All Categories
            </button>
            {categories.map((category) => (
              <button
                type="button"
                key={category.id}
                className={categoryId === category.id ? "active" : ""}
                onClick={() => setCategoryId(category.id)}
              >
                {category.name}
              </button>
            ))}
          </aside>

          {/* ── Product Results ───────────────────────────────────────────── */}
          <main ref={resultsRef} className="pos-results" aria-label="Product search results" aria-live="polite">
            {products.length === 0
              ? <div className="placeholder">No product found in local database.</div>
              : products.map((product, index) => (
                <button
                  type="button"
                  key={product.id}
                  data-pos-result="true"
                  className={index === selectedIndex ? "pos-result active" : "pos-result"}
                  onClick={() => addProductToCart(product)}
                  aria-selected={index === selectedIndex}
                  tabIndex={-1}
                >
                  <div>
                    <strong>{product.name}</strong>
                    <span>
                      {product.category}
                      {product.size ? ` | ${product.size}` : ""}
                      {product.brand ? ` | ${product.brand}` : ""}
                      {product.gauge ? ` | Gauge ${product.gauge}` : ""}
                    </span>
                  </div>
                  <div>
                    <strong>{saleType ? money(product.salePrice) : "Select sale type"}</strong>
                    <span>Stock: {product.stockQty}</span>
                  </div>
                </button>
              ))
            }
          </main>

          {/* ── Cart Panel ───────────────────────────────────────────────── */}
          <aside className="pos-cart-panel" aria-label="Invoice cart">

            {/* Header */}
            <div className="cart-head">
              <h3>Invoice Cart</h3>
              <button type="button" id="pos-clear-cart" onClick={handleClearCart} title="Clear cart (Alt+X)">
                Clear <KbdHint keys="Alt+X" />
              </button>
            </div>

            {/* Customer — Alt+U */}
            <div className="cart-field-wrap">
              <select
                ref={customerRef}
                id="pos-customer"
                className="select"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                aria-label="Customer"
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name} — {customer.customerType}</option>
                ))}
              </select>
              <KbdHint keys="Alt+U" />
            </div>

            {/* Payment Method — Alt+M */}
            <div className="cart-field-wrap">
              <select
                ref={paymentRef}
                id="pos-payment"
                className="select"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                aria-label="Payment method"
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="mixed">Mixed</option>
                {selectedCustomer?.customerType !== "walkin" ? <option value="credit">Credit / Khata</option> : null}
              </select>
              <KbdHint keys="Alt+M" />
            </div>

            {/* Sale Type — Alt+T */}
            <div className="cart-field-wrap">
              <select
                ref={saleTypeRef}
                id="pos-sale-type"
                className="select"
                value={saleType}
                onChange={(event) => setSaleType(event.target.value)}
                required
                aria-label="Sale type"
              >
                <option value="" disabled>Select Sale Type</option>
                {saleTypes.map((type) => <option key={type.key} value={type.key}>{type.name}</option>)}
              </select>
              <KbdHint keys="Alt+T" />
            </div>

            {/* Cart Items */}
            <div className="cart-items" aria-label="Cart items">
              {cart.length === 0 && (
                <div className="cart-empty-hint">
                  <span>Cart is empty — search &amp; press</span>
                  <KbdHint keys="Enter" />
                </div>
              )}
              {cart.map((item: PosCartItem, idx) => (
                <div
                  key={item._id}
                  data-cart-row="true"
                  className={idx === selectedCartIdx ? "cart-line cart-line-active" : "cart-line"}
                  onClick={() => setSelectedCartIdx(idx)}
                >
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.size || ""}</span>
                    {idx === selectedCartIdx && (
                      <span className="cart-item-shortcut-row">
                        <KbdHint keys="Alt+=" /> <KbdHint keys="Alt+−" /> <KbdHint keys="Alt+Del" />
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    max={item.stockQty}
                    value={item.quantity}
                    onChange={(event) => dispatch(updateItem({ id: item._id, patch: { quantity: Number(event.target.value) } }))}
                    aria-label={`Quantity for ${item.name}`}
                  />
                  <input
                    type="number"
                    step="1"
                    value={item.salePrice}
                    onChange={(event) => dispatch(updateItem({ id: item._id, patch: { salePrice: Number(event.target.value) } }))}
                    aria-label={`Sale price for ${item.name}`}
                  />
                  <button type="button" onClick={() => dispatch(removeItem(item._id))} aria-label={`Remove ${item.name}`}>×</button>
                </div>
              ))}
            </div>

            {/* Cart nav hint */}
            {cart.length > 1 && (
              <div className="cart-nav-hint">
                <KbdHint keys="Alt+PgUp" /> <KbdHint keys="Alt+PgDn" />
                <span>navigate cart items</span>
              </div>
            )}

            {/* Totals */}
            <div className="cart-totals">
              <div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
              <div>
                <span>Discount <KbdHint keys="Alt+D" /></span>
                <input
                  ref={discountRef}
                  id="pos-discount"
                  type="number"
                  placeholder="0"
                  value={discountAmount === 0 ? "" : discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                  aria-label="Discount amount"
                />
              </div>
              <div><span>Grand Total</span><strong>{money(totals.grandTotal)}</strong></div>
              <div>
                <span>Paid <KbdHint keys="Alt+A" /></span>
                <input
                  ref={paidRef}
                  id="pos-paid"
                  type="number"
                  placeholder="0"
                  value={paidAmount === 0 ? "" : paidAmount}
                  onChange={(event) => setPaidAmount(Number(event.target.value) || 0)}
                  disabled={paymentMethod === "credit"}
                  aria-label="Paid amount"
                />
              </div>
              <div><span>Due</span><strong>{money(totals.due)}</strong></div>
            </div>

            {/* Checkout Button */}
            <button
              id="pos-checkout-btn"
              className="checkout-btn"
              disabled={saving || !cart.length || !saleType}
              title="Checkout (Alt+C)"
            >
              {saving ? "Saving Locally..." : (
                <span className="checkout-btn-inner">
                  Checkout <KbdHint keys="Alt+C" />
                </span>
              )}
            </button>

            {/* Footer shortcuts bar */}
            <div className="pos-shortcut-footer">
              <span><KbdHint keys="Alt+N" /> New Sale</span>
              <button
                type="button"
                className="pos-help-btn"
                onClick={() => setShowHelp(true)}
                title="View all keyboard shortcuts"
                aria-label="Open keyboard shortcuts help"
              >
                ⌨️ Shortcuts <KbdHint keys="?" />
              </button>
            </div>

          </aside>
        </div>
      </form>
    </DashboardLayout>
  );
}
