"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Master = { _id: string; name: string };
type CategoryConfig = {
  key: string;
  label: string;
  aliases: string[];
  fields: string[];
  sizes: string[];
  fixedLengthFeet?: number;
  brandRequired?: boolean;
  gaugeRequired?: boolean;
};
type CategoryWithConfig = { _id: string; name: string; config: CategoryConfig };
type Variant = {
  _id: string;
  name: string;
  sku: string;
  brandId?: Master | null;
  categoryId?: Master | null;
  sizeLabel?: string;
  gauge?: string;
  lengthFeet?: number;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  distributorPrice?: number;
  dealerPrice?: number;
  minimumStock?: number;
  lowStockAlertQty?: number;
  description?: string;
  status: "active" | "inactive";
};
type StockRow = { productVariantId?: Variant | string; quantity: number };

type ProductForm = {
  categoryId: string;
  name: string;
  brandId: string;
  sizeLabel: string;
  gauge: string;
  lengthFeet: string;
  purchasePrice: string;
  retailPrice: string;
  wholesalePrice: string;
  distributorPrice: string;
  stock: string;
  minimumStock: string;
  description: string;
  status: "active" | "inactive";
};

const emptyForm: ProductForm = {
  categoryId: "",
  name: "",
  brandId: "",
  sizeLabel: "",
  gauge: "",
  lengthFeet: "0",
  purchasePrice: "0",
  retailPrice: "0",
  wholesalePrice: "0",
  distributorPrice: "0",
  stock: "0",
  minimumStock: "5",
  description: "",
  status: "active"
};

const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

export default function ProductsPage() {
  const [categories, setCategories] = useState<CategoryWithConfig[]>([]);
  const [brands, setBrands] = useState<Master[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedCategory = categories.find((cat) => cat._id === form.categoryId);
  const config = selectedCategory?.config;

  const showBrand = Boolean(config?.fields.includes("brand"));
  const showSize = Boolean(config?.fields.includes("size"));
  const showGauge = Boolean(config?.fields.includes("gauge"));
  const showLength = Boolean(config?.fields.includes("lengthFeet"));
  const showDescription = Boolean(config?.fields.includes("description"));
  const showMinimumStock = Boolean(config?.fields.includes("minimumStock"));

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [configRes, brandRes, variantRes, stockRes] = await Promise.all([
        api<{ data: CategoryWithConfig[] }>("/products/category-config"),
        api<{ data: Master[] }>("/master/brands"),
        api<{ data: Variant[] }>("/products/variants"),
        api<{ data: StockRow[] }>("/inventory/stocks").catch(() => ({ data: [] as StockRow[] }))
      ]);
      setCategories(configRes.data);
      setBrands(brandRes.data.filter((brand) => brand.name !== "No Brand"));
      setVariants(variantRes.data);
      setStocks(stockRes.data);
      setForm((prev) => ({
        ...prev,
        categoryId: prev.categoryId || configRes.data[0]?._id || "",
        brandId: prev.brandId || brandRes.data.find((brand) => brand.name !== "No Brand")?._id || ""
      }));
    } catch (err: any) {
      setError(err.message || "Products load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!config) return;
    setForm((prev) => ({
      ...prev,
      brandId: config.fields.includes("brand") ? prev.brandId : "",
      gauge: config.fields.includes("gauge") ? prev.gauge : "",
      lengthFeet: config.fixedLengthFeet !== undefined ? String(config.fixedLengthFeet) : (config.fields.includes("lengthFeet") ? prev.lengthFeet : "0"),
      sizeLabel: config.fields.includes("size") ? prev.sizeLabel : ""
    }));
  }, [form.categoryId]);

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of stocks) {
      const id = typeof row.productVariantId === "string" ? row.productVariantId : row.productVariantId?._id;
      if (id) map.set(id, (map.get(id) || 0) + Number(row.quantity || 0));
    }
    return map;
  }, [stocks]);

  const rows = useMemo(() => {
    const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
    return variants.filter((item) => {
      const text = [item.name, item.categoryId?.name, item.brandId?.name, item.sizeLabel, item.gauge, item.sku]
        .filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = tokens.length ? tokens.every((token) => text.includes(token)) : true;
      const matchesCategory = categoryFilter ? item.categoryId?._id === categoryFilter : true;
      return matchesSearch && matchesCategory;
    });
  }, [variants, search, categoryFilter]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      categoryId: categories[0]?._id || "",
      brandId: brands[0]?._id || ""
    });
  };

  const openAdd = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const editItem = (item: Variant) => {
    setEditingId(item._id);
    setForm({
      categoryId: item.categoryId?._id || "",
      name: item.name,
      brandId: item.brandId?._id || "",
      sizeLabel: item.sizeLabel || "",
      gauge: item.gauge || "",
      lengthFeet: String(item.lengthFeet || 0),
      purchasePrice: String(item.purchasePrice || 0),
      retailPrice: String(item.retailPrice || 0),
      wholesalePrice: String(item.wholesalePrice || 0),
      distributorPrice: String(item.distributorPrice || item.dealerPrice || 0),
      stock: String(stockMap.get(item._id) || 0),
      minimumStock: String(item.minimumStock || item.lowStockAlertQty || 5),
      description: item.description || "",
      status: item.status || "active"
    });
    setDrawerOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);
    try {
      const payload = {
        categoryId: form.categoryId,
        name: form.name.trim(),
        brandId: showBrand ? form.brandId || undefined : undefined,
        sizeLabel: showSize ? form.sizeLabel.trim() : undefined,
        gauge: showGauge ? form.gauge.trim() : undefined,
        lengthFeet: showLength ? Number(form.lengthFeet || 0) : 0,
        purchasePrice: Number(form.purchasePrice || 0),
        retailPrice: Number(form.retailPrice || 0),
        wholesalePrice: Number(form.wholesalePrice || 0),
        distributorPrice: Number(form.distributorPrice || 0),
        stock: Number(form.stock || 0),
        minimumStock: showMinimumStock ? Number(form.minimumStock || 0) : 5,
        description: showDescription ? form.description : "",
        status: form.status
      };
      if (editingId) {
        await api(`/products/variants/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
        setMessage("Product updated successfully.");
      } else {
        await api("/products/variants", { method: "POST", body: JSON.stringify(payload) });
        setMessage("Product added successfully.");
      }
      await loadAll();
      setDrawerOpen(false);
      resetForm();
    } catch (err: any) {
      setError(err.message || "Product save failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item: Variant) => {
    const ok = confirm(`Delete ${item.name}? If stock exists, delete will be blocked.`);
    if (!ok) return;
    try {
      await api(`/products/variants/${item._id}`, { method: "DELETE" });
      setMessage("Product deleted.");
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Delete failed");
    }
  };

  const exportCsv = () => {
    const header = "Product,Category,Brand,Size,Gauge,Length,Stock,Purchase,Retail,Wholesale,Distributor\n";
    const body = rows.map((item) => [
      item.name, item.categoryId?.name || "", item.brandId?.name || "", item.sizeLabel || "", item.gauge || "",
      item.lengthFeet || "", stockMap.get(item._id) || 0, item.purchasePrice, item.retailPrice, item.wholesalePrice, item.distributorPrice || item.dealerPrice || 0
    ].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hardware-sanitary-products.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout title="Products">
      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      <div className="k-page-toolbar">
        <div>
          <h2>Products</h2>
          <p>Category select karo, form khud relevant fields show karega.</p>
        </div>
        <div className="k-toolbar-actions">
          <button className="k-outline-btn" onClick={exportCsv}>⇩ Export</button>
          <a className="k-outline-btn" href="/bulk-products">Bulk Import</a>
          <button className="k-primary-btn" onClick={openAdd}>+ New Product</button>
        </div>
      </div>

      <div className="k-filter-row pos-management-filters">
        <div className="k-search-box">
          <span>⌕</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, category, size, brand" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((cat) => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
        </select>
      </div>

      <div className="k-table-card">
        <div className="k-table-wrap">
          <table className="k-products-table">
            <thead><tr><th>Product</th><th>Category</th><th>Brand</th><th>Size</th><th>Gauge</th><th>Length</th><th>Stock</th><th>Retail</th><th>Purchase</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={10}>Loading...</td></tr> : rows.length === 0 ? <tr><td colSpan={10}>No products found.</td></tr> : rows.map((item) => (
                <tr key={item._id}>
                  <td><strong>{item.name}</strong><div className="muted-small">{item.sku}</div></td>
                  <td>{item.categoryId?.name || "-"}</td>
                  <td>{item.brandId?.name === "No Brand" ? "-" : item.brandId?.name || "-"}</td>
                  <td>{item.sizeLabel || "-"}</td>
                  <td>{item.gauge || "-"}</td>
                  <td>{item.lengthFeet ? `${item.lengthFeet} ft` : "-"}</td>
                  <td><strong>{stockMap.get(item._id) || 0}</strong></td>
                  <td>{money(item.retailPrice)}</td>
                  <td>{money(item.purchasePrice)}</td>
                  <td><div className="k-row-menu"><button onClick={() => editItem(item)}>Edit</button><button className="danger-text" onClick={() => deleteItem(item)}>Delete</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawerOpen ? (
        <div className="k-drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <aside className="k-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="k-drawer-header">
              <div><h3>{editingId ? "Edit Product" : "Add Product"}</h3><p>Dynamic fields based on selected category.</p></div>
              <button onClick={() => setDrawerOpen(false)}>×</button>
            </div>
            <form onSubmit={submit} className="k-drawer-form">
              <Field label="Category">
                <select className="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
                  <option value="">Select Category</option>
                  {categories.map((cat) => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                </select>
              </Field>
              <Field label="Product Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Elbow, Socket, Pipe, Muslim Shower" required /></Field>

              {showBrand ? <Field label="Brand (Optional)"><select className="select" value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}><option value="">No Brand</option>{brands.map((brand) => <option key={brand._id} value={brand._id}>{brand.name}</option>)}</select></Field> : null}
              {showSize ? <Field label="Size"><input className="input" list="size-options" value={form.sizeLabel} onChange={(e) => setForm({ ...form, sizeLabel: e.target.value })} placeholder="1/2, 1, 25mm" required /><datalist id="size-options">{config?.sizes.map((size) => <option key={size} value={size} />)}</datalist></Field> : null}
              {showGauge ? <Field label="Gauge / Thickness"><input className="input" value={form.gauge} onChange={(e) => setForm({ ...form, gauge: e.target.value })} placeholder="41, 64, SCH40" required={Boolean(config?.gaugeRequired)} /></Field> : null}
              {showLength ? <Field label="Length"><input className="input" type="number" value={form.lengthFeet} onChange={(e) => setForm({ ...form, lengthFeet: e.target.value })} disabled={config?.fixedLengthFeet !== undefined} /></Field> : null}

              <div className="k-drawer-grid">
                <Field label="Purchase Price"><input className="input" type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} required /></Field>
                <Field label="Retail Price"><input className="input" type="number" value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value })} required /></Field>
                <Field label="Wholesale Price"><input className="input" type="number" value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} /></Field>
                <Field label="Distributor Price"><input className="input" type="number" value={form.distributorPrice} onChange={(e) => setForm({ ...form, distributorPrice: e.target.value })} /></Field>
                <Field label="Stock"><input className="input" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></Field>
                {showMinimumStock ? <Field label="Minimum Stock"><input className="input" type="number" value={form.minimumStock} onChange={(e) => setForm({ ...form, minimumStock: e.target.value })} /></Field> : null}
              </div>
              {showDescription ? <Field label="Description"><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field> : null}
              <button className="k-primary-btn full" disabled={saving}>{saving ? "Saving..." : editingId ? "Update Product" : "Save Product"}</button>
            </form>
          </aside>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label>{label}</label>{children}</div>;
}
