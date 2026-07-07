"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Warehouse = {
  _id: string;
  name: string;
  type: string;
};

type Customer = {
  _id: string;
  name: string;
  phone?: string;
  customerType: "walkin" | "regular" | "plumber" | "contractor" | "dealer";
  currentBalance: number;
};

type PosProduct = {
  _id: string;
  name: string;
  sku: string;
  barcode?: string;
  brand?: string;
  category?: string;
  size?: string;
  unit?: string;
  saleUnit: string;
  baseUnit: string;
  lengthPerPiece?: number;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice?: number;
  plumberPrice?: number;
  dealerPrice?: number;
  allowDecimalQty?: boolean;
  stockQty: number;
};

type CartItem = PosProduct & {
  quantity: string;
  salePrice: string;
  discount: string;
};

type Sale = {
  _id: string;
  invoiceNo: string;
  customerId?: Customer;
  warehouseId?: Warehouse;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: string;
  paymentMethod: string;
  saleType: string;
  createdAt: string;
  items: {
    productNameSnapshot: string;
    skuSnapshot: string;
    quantity: number;
    salePrice: number;
    total: number;
  }[];
};

const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;
const today = () => new Date().toISOString().slice(0, 10);

const priceForType = (product: PosProduct, saleType: string) => {
  if (saleType === "plumber" && Number(product.plumberPrice || 0) > 0) return Number(product.plumberPrice);
  if (saleType === "wholesale" && Number(product.wholesalePrice || 0) > 0) return Number(product.wholesalePrice);
  if (saleType === "dealer" && Number(product.dealerPrice || 0) > 0) return Number(product.dealerPrice);
  return Number(product.retailPrice || 0);
};

export default function PosPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const [warehouseId, setWarehouseId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [saleType, setSaleType] = useState("walkin");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [note, setNote] = useState("");

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingSale, setSavingSale] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadBase = async () => {
    setLoading(true);
    setError("");

    try {
      const [warehouseRes, customerRes, salesRes] = await Promise.all([
        api<{ data: Warehouse[] }>("/master/warehouses"),
        api<{ data: Customer[] }>("/customers"),
        api<{ data: Sale[] }>(`/sales?from=${today()}&to=${today()}`)
      ]);

      setWarehouses(warehouseRes.data);
      setCustomers(customerRes.data);
      setSales(salesRes.data);

      const defaultWarehouse =
        warehouseRes.data.find((warehouse) => warehouse.type === "shop") ||
        warehouseRes.data[0];

      const walkin =
        customerRes.data.find((customer) => customer.customerType === "walkin") ||
        customerRes.data[0];

      setWarehouseId((prev) => prev || defaultWarehouse?._id || "");
      setCustomerId((prev) => prev || walkin?._id || "");
    } catch (err: any) {
      setError(err.message || "POS data load failed");
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    if (!warehouseId) return;

    try {
      const params = new URLSearchParams();
      params.set("warehouseId", warehouseId);
      if (search.trim()) params.set("q", search.trim());

      const res = await api<{ data: PosProduct[] }>(`/sales/pos-products?${params.toString()}`);
      setProducts(res.data);
    } catch (err: any) {
      setError(err.message || "Product search failed");
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    if (warehouseId) loadProducts();
  }, [warehouseId]);

  useEffect(() => {
    const customer = customers.find((item) => item._id === customerId);
    if (!customer) return;

    if (customer.customerType === "walkin") {
      setSaleType("walkin");
      if (paymentMethod === "credit") setPaymentMethod("cash");
      return;
    }

    if (customer.customerType === "plumber") setSaleType("plumber");
    else if (customer.customerType === "dealer") setSaleType("dealer");
    else setSaleType("retail");
  }, [customerId]);

  useEffect(() => {
    setCart((prev) =>
      prev.map((item) => ({
        ...item,
        salePrice: String(priceForType(item, saleType))
      }))
    );
  }, [saleType]);

  const selectedCustomer = customers.find((customer) => customer._id === customerId);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.salePrice || 0);
      const discount = Number(item.discount || 0);
      return sum + Math.max(0, qty * price - discount);
    }, 0);

    const billDiscount = Number(discountAmount || 0);
    const grandTotal = Math.max(0, subtotal - billDiscount);
    const paid = paymentMethod === "credit" ? 0 : Math.min(Number(paidAmount || 0), grandTotal);
    const due = Math.max(0, grandTotal - paid);

    return { subtotal, billDiscount, grandTotal, paid, due };
  }, [cart, discountAmount, paidAmount, paymentMethod]);

  useEffect(() => {
    if (paymentMethod === "cash" && cart.length > 0) {
      setPaidAmount(String(totals.grandTotal));
    }
    if (paymentMethod === "credit") {
      setPaidAmount("0");
    }
  }, [paymentMethod, cart.length, totals.grandTotal]);

  const addToCart = (product: PosProduct) => {
    setMessage("");
    setError("");

    if (product.stockQty <= 0) {
      setError("This product is out of stock in selected warehouse.");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item._id === product._id);

      if (existing) {
        return prev.map((item) => {
          if (item._id !== product._id) return item;

          const nextQty = Number(item.quantity || 0) + 1;
          if (nextQty > product.stockQty) {
            setError(`Only ${product.stockQty} available for ${product.name}.`);
            return item;
          }

          return { ...item, quantity: String(nextQty) };
        });
      }

      return [
        ...prev,
        {
          ...product,
          quantity: "1",
          salePrice: String(priceForType(product, saleType)),
          discount: "0"
        }
      ];
    });
  };

  const updateCartItem = (id: string, patch: Partial<CartItem>) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item._id !== id) return item;

        const next = { ...item, ...patch };

        if (patch.quantity !== undefined) {
          const qty = Number(patch.quantity || 0);
          if (qty > item.stockQty) {
            setError(`Only ${item.stockQty} available for ${item.name}.`);
            return item;
          }
        }

        return next;
      })
    );
  };

  const removeCartItem = (id: string) => {
    setCart((prev) => prev.filter((item) => item._id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount("0");
    setPaidAmount("0");
    setNote("");
    setLastSale(null);
  };

  const submitSale = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSavingSale(true);

    try {
      if (!warehouseId) throw new Error("Please select warehouse/shop.");
      if (!customerId) throw new Error("Please select customer.");
      if (cart.length === 0) throw new Error("Cart is empty.");

      const payload = {
        customerId,
        warehouseId,
        saleType,
        paymentMethod,
        discountAmount: Number(discountAmount || 0),
        paidAmount: Number(paidAmount || 0),
        note,
        items: cart.map((item) => ({
          productVariantId: item._id,
          quantity: Number(item.quantity || 0),
          salePrice: Number(item.salePrice || 0),
          discount: Number(item.discount || 0)
        }))
      };

      const res = await api<{ data: { sale: Sale; totalProfit: number } }>("/sales", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setLastSale(res.data.sale);
      setMessage(`Sale saved successfully. Invoice: ${res.data.sale.invoiceNo}`);
      setCart([]);
      setDiscountAmount("0");
      setPaidAmount("0");
      setNote("");

      await loadProducts();

      const [customerRes, salesRes] = await Promise.all([
        api<{ data: Customer[] }>("/customers"),
        api<{ data: Sale[] }>(`/sales?from=${today()}&to=${today()}`)
      ]);
      setCustomers(customerRes.data);
      setSales(salesRes.data);
    } catch (err: any) {
      setError(err.message || "Sale save failed");
    } finally {
      setSavingSale(false);
    }
  };

  const canCreditSale = selectedCustomer && selectedCustomer.customerType !== "walkin";

  return (
    <DashboardLayout title="POS Sale">
      <div className="page-header">
        <div>
          <h2>POS Sale</h2>
          <p>Walk-in cash sale, plumber khata sale, product search, cart aur stock auto minus.</p>
        </div>

        <button className="btn btn-light" onClick={() => { loadBase(); loadProducts(); }}>
          Refresh
        </button>
      </div>

      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      <form onSubmit={submitSale}>
        <div className="pos-full-layout">
          <div className="card">
            <div className="section-title">
              <h3>Product Search</h3>
              <span className="badge">{products.length} items</span>
            </div>

            <div className="form-group">
              <label>Stock Location</label>
              <select
                className="select"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
              >
                <option value="">Select warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse._id} value={warehouse._id}>
                    {warehouse.name} ({warehouse.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="search-combo">
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, SKU, barcode, size, brand"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    loadProducts();
                  }
                }}
              />
              <button className="btn btn-light" type="button" onClick={loadProducts}>
                Search
              </button>
            </div>

            <div className="pos-products-list">
              {loading ? (
                <p className="placeholder">Loading...</p>
              ) : products.length === 0 ? (
                <p className="placeholder">No product found. Add stock in Inventory first.</p>
              ) : (
                products.map((product) => (
                  <button
                    key={product._id}
                    type="button"
                    className="pos-product-card"
                    onClick={() => addToCart(product)}
                  >
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.sku} • {product.brand || "-"} • Size {product.size || "-"}</span>
                    </div>
                    <div>
                      <strong>{money(priceForType(product, saleType))}</strong>
                      <span className={product.stockQty <= 0 ? "danger-text" : ""}>
                        Stock: {product.stockQty} {product.saleUnit}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="section-title">
              <h3>Cart</h3>
              <button className="small-btn danger-text" type="button" onClick={clearCart}>
                Clear
              </button>
            </div>

            <div className="table-wrap pos-cart-table">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Disc.</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr><td colSpan={6}>No item added yet.</td></tr>
                  ) : (
                    cart.map((item) => {
                      const qty = Number(item.quantity || 0);
                      const price = Number(item.salePrice || 0);
                      const discount = Number(item.discount || 0);
                      const total = Math.max(0, qty * price - discount);

                      return (
                        <tr key={item._id}>
                          <td>
                            <strong>{item.name}</strong>
                            <div className="muted-small">
                              {item.sku} • Stock {item.stockQty} • {item.lengthPerPiece ? `${item.lengthPerPiece}ft/length` : item.saleUnit}
                            </div>
                          </td>
                          <td>
                            <input
                              className="input mini-input"
                              type="number"
                              step={item.allowDecimalQty ? "0.001" : "1"}
                              min="0"
                              value={item.quantity}
                              onChange={(e) => updateCartItem(item._id, { quantity: e.target.value })}
                              required
                            />
                          </td>
                          <td>
                            <input
                              className="input mini-input"
                              type="number"
                              step="0.01"
                              value={item.salePrice}
                              onChange={(e) => updateCartItem(item._id, { salePrice: e.target.value })}
                              required
                            />
                          </td>
                          <td>
                            <input
                              className="input mini-input"
                              type="number"
                              step="0.01"
                              value={item.discount}
                              onChange={(e) => updateCartItem(item._id, { discount: e.target.value })}
                            />
                          </td>
                          <td><strong>{money(total)}</strong></td>
                          <td>
                            <button className="small-btn danger-text" type="button" onClick={() => removeCartItem(item._id)}>
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="pos-total-box">
              <div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
              <div>
                <span>Bill Discount</span>
                <input
                  className="input mini-input"
                  type="number"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                />
              </div>
              <div><span>Grand Total</span><strong>{money(totals.grandTotal)}</strong></div>
            </div>
          </div>

          <div className="card">
            <div className="section-title">
              <h3>Payment</h3>
              <span className="badge">{saleType}</span>
            </div>

            <div className="form-group">
              <label>Customer</label>
              <select
                className="select"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.name} — {customer.customerType} — Bal {money(customer.currentBalance)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid one-col">
              <div className="form-group">
                <label>Sale Type</label>
                <select
                  className="select"
                  value={saleType}
                  onChange={(e) => setSaleType(e.target.value)}
                >
                  <option value="walkin">Walk-in / Retail</option>
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="plumber">Plumber</option>
                  <option value="dealer">Dealer</option>
                </select>
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <select
                  className="select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="mixed">Mixed</option>
                  {canCreditSale ? <option value="credit">Credit / Khata</option> : null}
                </select>
              </div>

              <div className="form-group">
                <label>Paid Amount</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  disabled={paymentMethod === "credit"}
                />
              </div>
            </div>

            <div className="payment-summary" style={{ marginBottom: 20 }}>
              <div><span>Grand Total</span><strong>{money(totals.grandTotal)}</strong></div>
              <div><span>Paid</span><strong>{money(totals.paid)}</strong></div>
              <div><span>Due / Khata</span><strong className={totals.due > 0 ? "danger-text" : ""}>{money(totals.due)}</strong></div>
              {selectedCustomer ? (
                <div><span>Old Balance</span><strong>{money(selectedCustomer.currentBalance)}</strong></div>
              ) : null}
            </div>

            <div className="form-group">
              <label>Note</label>
              <textarea
                className="input"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Site note, plumber note, invoice note"
              />
            </div>

            <button className="btn" style={{ width: "100%" }} disabled={savingSale || cart.length === 0}>
              {savingSale ? "Saving Sale..." : "Save Sale"}
            </button>

            {lastSale ? (
              <div className="last-invoice">
                <h4>Last Invoice</h4>
                <p><strong>{lastSale.invoiceNo}</strong></p>
                <p>Total: {money(lastSale.grandTotal)}</p>
                <p>Due: {money(lastSale.dueAmount)}</p>
                <button className="small-btn" type="button" onClick={() => window.print()}>
                  Print Page
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </form>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-title">
          <h3>Today Sales</h3>
          <span className="badge">{sales.length} invoices</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Paid / Due</th>
                <th>Method</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr><td colSpan={7}>No sales today.</td></tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale._id}>
                    <td><strong>{sale.invoiceNo}</strong></td>
                    <td>
                      {sale.customerId?.name || "-"}
                      <div className="muted-small">{sale.customerId?.customerType || ""}</div>
                    </td>
                    <td>
                      {sale.items.slice(0, 2).map((item) => (
                        <div key={`${sale._id}-${item.skuSnapshot}`}>
                          {item.productNameSnapshot} × {item.quantity}
                        </div>
                      ))}
                      {sale.items.length > 2 ? (
                        <div className="muted-small">+{sale.items.length - 2} more</div>
                      ) : null}
                    </td>
                    <td>{money(sale.grandTotal)}</td>
                    <td>
                      <div>Paid: {money(sale.paidAmount)}</div>
                      <div className="muted-small">Due: {money(sale.dueAmount)}</div>
                    </td>
                    <td>{sale.paymentMethod}</td>
                    <td>{new Date(sale.createdAt).toLocaleTimeString()}</td>
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
