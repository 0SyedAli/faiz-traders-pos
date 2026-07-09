"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Master = { _id: string; name: string; shortName?: string };
type Product = { _id: string; name: string; description?: string; status: "active" | "inactive"; categoryId?: Master; brandId?: Master };
type Variant = {
  _id: string; name: string; sku: string; barcode?: string; saleUnit: string; baseUnit: string; lengthPerPiece?: number;
  purchasePrice: number; retailPrice: number; wholesalePrice?: number; plumberPrice?: number; dealerPrice?: number;
  lowStockAlertQty?: number; allowDecimalQty?: boolean; status: "active" | "inactive";
  productId?: Product; brandId?: Master; categoryId?: Master; sizeId?: Master; gauge?: string; unitId?: Master;
};
type StockRow = { _id: string; quantity: number; productVariantId?: Variant | string };

type ProductForm = { name: string; categoryId: string; brandId: string; description: string; status: "active" | "inactive" };
type VariantForm = {
  productId: string; name: string; sku: string; barcode: string; brandId: string; categoryId: string; sizeId: string; gauge: string; unitId: string;
  saleUnit: string; baseUnit: string; lengthPerPiece: string; purchasePrice: string; retailPrice: string; wholesalePrice: string;
  plumberPrice: string; dealerPrice: string; lowStockAlertQty: string; allowDecimalQty: boolean; status: "active" | "inactive";
};

const emptyProductForm: ProductForm = { name: "", categoryId: "", brandId: "", description: "", status: "active" };
const emptyVariantForm: VariantForm = {
  productId: "", name: "", sku: "", barcode: "", brandId: "", categoryId: "", sizeId: "", gauge: "", unitId: "",
  saleUnit: "piece", baseUnit: "piece", lengthPerPiece: "0", purchasePrice: "0", retailPrice: "0", wholesalePrice: "0",
  plumberPrice: "0", dealerPrice: "0", lowStockAlertQty: "5", allowDecimalQty: false, status: "active"
};

const money = (v: number) => `Rs. ${Number(v || 0).toLocaleString()}`;
const csv = (v: unknown) => {
  const text = String(v ?? "");
  return text.includes(",") || text.includes('"') ? `"${text.replace(/"/g, '""')}"` : text;
};

export default function ProductsPage() {
  const [brands, setBrands] = useState<Master[]>([]);
  const [categories, setCategories] = useState<Master[]>([]);
  const [units, setUnits] = useState<Master[]>([]);
  const [sizes, setSizes] = useState<Master[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);

  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [variantForm, setVariantForm] = useState<VariantForm>(emptyVariantForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"variant" | "product">("variant");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true); setError("");
    try {
      const [brandRes, categoryRes, unitRes, sizeRes, productRes, variantRes, stockRes] = await Promise.all([
        api<{ data: Master[] }>("/master/brands"), api<{ data: Master[] }>("/master/categories"),
        api<{ data: Master[] }>("/master/units"), api<{ data: Master[] }>("/master/sizes"),
        api<{ data: Product[] }>("/products"), api<{ data: Variant[] }>("/products/variants"),
        api<{ data: StockRow[] }>("/inventory/stocks").catch(() => ({ data: [] as StockRow[] }))
      ]);
      setBrands(brandRes.data); setCategories(categoryRes.data); setUnits(unitRes.data); setSizes(sizeRes.data);
      setProducts(productRes.data); setVariants(variantRes.data); setStocks(stockRes.data);
      setProductForm((p) => ({ ...p, brandId: p.brandId || brandRes.data[0]?._id || "", categoryId: p.categoryId || categoryRes.data[0]?._id || "" }));
      setVariantForm((p) => ({ ...p, productId: p.productId || productRes.data[0]?._id || "", brandId: p.brandId || brandRes.data[0]?._id || "", categoryId: p.categoryId || categoryRes.data[0]?._id || "", unitId: p.unitId || unitRes.data[0]?._id || "", sizeId: p.sizeId || sizeRes.data[0]?._id || "" }));
    } catch (err: any) { setError(err.message || "Data load failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    stocks.forEach((s) => {
      const id = typeof s.productVariantId === "string" ? s.productVariantId : s.productVariantId?._id;
      if (id) map.set(id, (map.get(id) || 0) + Number(s.quantity || 0));
    });
    return map;
  }, [stocks]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let data = variants.filter((v) => {
      const text = [v.name, v.sku, v.barcode, v.brandId?.name, v.categoryId?.name, v.sizeId?.name, v.gauge, v.productId?.name].filter(Boolean).join(" ").toLowerCase();
      return (!q || text.includes(q)) && (!brandFilter || v.brandId?._id === brandFilter) && (!categoryFilter || v.categoryId?._id === categoryFilter);
    });
    if (sortBy === "name") data = [...data].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "price-high") data = [...data].sort((a, b) => Number(b.retailPrice || 0) - Number(a.retailPrice || 0));
    if (sortBy === "price-low") data = [...data].sort((a, b) => Number(a.retailPrice || 0) - Number(b.retailPrice || 0));
    return data;
  }, [variants, search, brandFilter, categoryFilter, sortBy]);

  const resetVariant = () => setVariantForm({ ...emptyVariantForm, productId: products[0]?._id || "", brandId: brands[0]?._id || "", categoryId: categories[0]?._id || "", unitId: units[0]?._id || "", sizeId: sizes[0]?._id || "" });
  const openNew = () => { setEditingVariantId(null); setEditingProductId(null); resetVariant(); setProductForm({ ...emptyProductForm, brandId: brands[0]?._id || "", categoryId: categories[0]?._id || "" }); setDrawerMode("variant"); setDrawerOpen(true); };

  const submitProduct = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const payload = { ...productForm, name: productForm.name.trim(), description: productForm.description.trim() };
      if (editingProductId) await api(`/products/${editingProductId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/products", { method: "POST", body: JSON.stringify(payload) });
      setMessage(editingProductId ? "Product group updated." : "Product group saved.");
      setEditingProductId(null); setProductForm(emptyProductForm); await loadAll(); setDrawerMode("variant");
    } catch (err: any) { setError(err.message || "Product save failed"); }
    finally { setSaving(false); }
  };

  const submitVariant = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const payload = { ...variantForm, name: variantForm.name.trim(), sku: variantForm.sku.trim().toUpperCase(), barcode: variantForm.barcode.trim() || undefined, gauge: variantForm.gauge.trim() || undefined, lengthPerPiece: Number(variantForm.lengthPerPiece || 0), purchasePrice: Number(variantForm.purchasePrice || 0), retailPrice: Number(variantForm.retailPrice || 0), wholesalePrice: Number(variantForm.wholesalePrice || 0), plumberPrice: Number(variantForm.plumberPrice || 0), dealerPrice: Number(variantForm.dealerPrice || 0), lowStockAlertQty: Number(variantForm.lowStockAlertQty || 0) };
      if (editingVariantId) await api(`/products/variants/${editingVariantId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/products/variants", { method: "POST", body: JSON.stringify(payload) });
      setMessage(editingVariantId ? "Product updated." : "Product added.");
      setEditingVariantId(null); resetVariant(); setDrawerOpen(false); await loadAll();
    } catch (err: any) { setError(err.message || "Variant save failed"); }
    finally { setSaving(false); }
  };

  const editVariant = (v: Variant) => {
    setEditingVariantId(v._id); setDrawerMode("variant"); setDrawerOpen(true);
    setVariantForm({ productId: v.productId?._id || "", name: v.name, sku: v.sku, barcode: v.barcode || "", brandId: v.brandId?._id || "", categoryId: v.categoryId?._id || "", sizeId: v.sizeId?._id || "", gauge: v.gauge || "", unitId: v.unitId?._id || "", saleUnit: v.saleUnit || "piece", baseUnit: v.baseUnit || "piece", lengthPerPiece: String(v.lengthPerPiece || 0), purchasePrice: String(v.purchasePrice || 0), retailPrice: String(v.retailPrice || 0), wholesalePrice: String(v.wholesalePrice || 0), plumberPrice: String(v.plumberPrice || 0), dealerPrice: String(v.dealerPrice || 0), lowStockAlertQty: String(v.lowStockAlertQty || 5), allowDecimalQty: Boolean(v.allowDecimalQty), status: v.status || "active" });
  };

  const toggleStatus = async (v: Variant) => {
    setError(""); setMessage("");
    try {
      await api(`/products/variants/${v._id}`, { method: "PUT", body: JSON.stringify({ ...v, productId: v.productId?._id, brandId: v.brandId?._id, categoryId: v.categoryId?._id, sizeId: v.sizeId?._id, unitId: v.unitId?._id, status: v.status === "active" ? "inactive" : "active" }) });
      setMessage("Status updated."); await loadAll();
    } catch (err: any) { setError(err.message || "Status update failed"); }
  };

  const deleteVariant = async (v: Variant) => {
    if (!confirm(`Delete ${v.name}?`)) return;
    try { await api(`/products/variants/${v._id}`, { method: "DELETE" }); setMessage("Product deleted."); await loadAll(); }
    catch (err: any) { setError(err.message || "Delete failed"); }
  };

  const exportCsv = () => {
    const header = ["Code", "Product", "Category", "Unit", "Quantity", "Selling Price", "Purchase Price", "Brand", "Size", "Gauge", "Status"];
    const lines = rows.map((v) => [v.sku, v.name, v.categoryId?.name || "", v.unitId?.shortName || v.unitId?.name || v.saleUnit, stockMap.get(v._id) || 0, v.retailPrice, v.purchasePrice, v.brandId?.name || "", v.sizeId?.name || "", v.gauge || "", v.status].map(csv).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "products-export.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout title="Products">
      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      <div className="k-page-toolbar">
        <div><h2>Products</h2><p>Simple product list, auto search, export and quick add.</p></div>
        <div className="k-toolbar-actions"><button className="k-outline-btn" onClick={exportCsv}>⇩ Export</button><button className="k-primary-btn" onClick={openNew}>+ New Product</button></div>
      </div>

      <div className="k-filter-row">
        <div className="k-search-box"><span>⌕</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, SKU, barcode, size, gauge" /></div>
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}><option value="">All Brands</option>{brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="">All Categories</option>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="latest">Sort By: Latest</option><option value="name">Sort By: Name</option><option value="price-high">Price: High to Low</option><option value="price-low">Price: Low to High</option></select>
        <button className="k-outline-btn" type="button">☷ Column</button>
      </div>

      <div className="k-table-card">
        <div className="k-table-wrap">
          <table className="k-products-table">
            <thead><tr><th><input type="checkbox" /></th><th>Code</th><th>Product</th><th>Category</th><th>Unit</th><th>Quantity</th><th>Selling Price</th><th>Purchase Price</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={10}>Loading...</td></tr> : rows.length === 0 ? <tr><td colSpan={10}>No products found.</td></tr> : rows.map((v) => {
                const initials = v.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
                return <tr key={v._id}>
                  <td><input type="checkbox" /></td><td className="k-code">{v.sku}</td>
                  <td><div className="k-product-cell"><div className="k-product-avatar">{initials || "P"}</div><div><strong>{v.name}</strong><span>{v.brandId?.name || "-"}{v.sizeId?.name ? ` • Size ${v.sizeId.name}` : ""}{v.gauge ? ` • Gauge ${v.gauge}` : ""}</span></div></div></td>
                  <td>{v.categoryId?.name || "-"}</td><td>{v.unitId?.shortName || v.unitId?.name || v.saleUnit}</td><td>{stockMap.get(v._id) || 0}</td><td>{money(v.retailPrice)}</td><td>{money(v.purchasePrice)}</td>
                  <td><button className={v.status === "active" ? "k-toggle on" : "k-toggle"} type="button" onClick={() => toggleStatus(v)}><span /></button></td>
                  <td><div className="k-row-menu"><button onClick={() => editVariant(v)}>Edit</button><button className="danger-text" onClick={() => deleteVariant(v)}>Delete</button></div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="k-table-footer"><span>Row Per Page</span><select defaultValue="10"><option>10</option><option>25</option><option>50</option></select><span>Entries</span><div className="k-pagination"><button>←</button><button className="active">1</button><button>2</button><button>→</button></div></div>
      </div>

      {drawerOpen ? <div className="k-drawer-backdrop" onClick={() => setDrawerOpen(false)}><aside className="k-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="k-drawer-header"><div><h3>{drawerMode === "product" ? "Product Group" : "New Product"}</h3><p>{drawerMode === "product" ? "Create group like PVC Pipe or Elbow" : "Create sellable item/variant"}</p></div><button onClick={() => setDrawerOpen(false)}>×</button></div>
        <div className="k-drawer-tabs"><button className={drawerMode === "product" ? "active" : ""} onClick={() => setDrawerMode("product")}>Product Group</button><button className={drawerMode === "variant" ? "active" : ""} onClick={() => setDrawerMode("variant")}>Variant</button></div>
        {drawerMode === "product" ? <form className="k-drawer-form" onSubmit={submitProduct}>
          <Field label="Product Name"><input className="input" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required /></Field>
          <Field label="Brand"><select className="select" value={productForm.brandId} onChange={(e) => setProductForm({ ...productForm, brandId: e.target.value })}>{brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></Field>
          <Field label="Category"><select className="select" value={productForm.categoryId} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></Field>
          <Field label="Description"><textarea className="input" rows={3} value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} /></Field>
          <button className="k-primary-btn full" disabled={saving}>{saving ? "Saving..." : "Save Product Group"}</button>
        </form> : <form className="k-drawer-form" onSubmit={submitVariant}>
          <div className="k-preset-row"><button type="button" onClick={() => setVariantForm({ ...variantForm, saleUnit: "length", baseUnit: "feet", lengthPerPiece: "20" })}>Pipe 20ft Preset</button><button type="button" onClick={() => setVariantForm({ ...variantForm, saleUnit: "piece", baseUnit: "piece", lengthPerPiece: "0" })}>Fitting Preset</button></div>
          <Field label="Product Group"><select className="select" value={variantForm.productId} onChange={(e) => setVariantForm({ ...variantForm, productId: e.target.value })}>{products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></Field>
          <Field label="Variant Name"><input className="input" value={variantForm.name} onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })} placeholder="PVC Pipe Steelex 3 inch Gauge 41 20ft" required /></Field>
          <div className="k-drawer-grid">
            <Field label="SKU"><input className="input" value={variantForm.sku} onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })} required /></Field>
            <Field label="Barcode"><input className="input" value={variantForm.barcode} onChange={(e) => setVariantForm({ ...variantForm, barcode: e.target.value })} /></Field>
            <Field label="Brand"><select className="select" value={variantForm.brandId} onChange={(e) => setVariantForm({ ...variantForm, brandId: e.target.value })}>{brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></Field>
            <Field label="Category"><select className="select" value={variantForm.categoryId} onChange={(e) => setVariantForm({ ...variantForm, categoryId: e.target.value })}>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></Field>
            <Field label="Size"><select className="select" value={variantForm.sizeId} onChange={(e) => setVariantForm({ ...variantForm, sizeId: e.target.value })}><option value="">No size</option>{sizes.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>
            <Field label="Gauge / Thickness"><input className="input" value={variantForm.gauge} onChange={(e) => setVariantForm({ ...variantForm, gauge: e.target.value })} placeholder="41, 64, Heavy" /></Field>
            <Field label="Unit"><select className="select" value={variantForm.unitId} onChange={(e) => setVariantForm({ ...variantForm, unitId: e.target.value })}>{units.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select></Field>
            <Field label="Length"><input className="input" type="number" step="0.001" value={variantForm.lengthPerPiece} onChange={(e) => setVariantForm({ ...variantForm, lengthPerPiece: e.target.value })} /></Field>
            <Field label="Purchase Price"><input className="input" type="number" step="0.01" value={variantForm.purchasePrice} onChange={(e) => setVariantForm({ ...variantForm, purchasePrice: e.target.value })} /></Field>
            <Field label="Selling Price"><input className="input" type="number" step="0.01" value={variantForm.retailPrice} onChange={(e) => setVariantForm({ ...variantForm, retailPrice: e.target.value })} /></Field>
            <Field label="Plumber Price"><input className="input" type="number" step="0.01" value={variantForm.plumberPrice} onChange={(e) => setVariantForm({ ...variantForm, plumberPrice: e.target.value })} /></Field>
            <Field label="Low Stock Alert"><input className="input" type="number" value={variantForm.lowStockAlertQty} onChange={(e) => setVariantForm({ ...variantForm, lowStockAlertQty: e.target.value })} /></Field>
          </div>
          <button className="k-primary-btn full" disabled={saving}>{saving ? "Saving..." : "Save Product"}</button>
        </form>}
      </aside></div> : null}
    </DashboardLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label>{label}</label>{children}</div>;
}
