"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Master = {
  _id: string;
  name: string;
  shortName?: string;
};

type Product = {
  _id: string;
  name: string;
  description?: string;
  status: "active" | "inactive";
  categoryId?: Master;
  brandId?: Master;
};

type Variant = {
  _id: string;
  name: string;
  sku: string;
  barcode?: string;
  saleUnit: string;
  baseUnit: string;
  lengthPerPiece?: number;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice?: number;
  plumberPrice?: number;
  dealerPrice?: number;
  lowStockAlertQty?: number;
  allowDecimalQty?: boolean;
  status: "active" | "inactive";
  productId?: Master;
  brandId?: Master;
  categoryId?: Master;
  sizeId?: Master;
  gauge?: string;
  unitId?: Master;
};

type ProductForm = {
  name: string;
  categoryId: string;
  brandId: string;
  description: string;
  status: "active" | "inactive";
};

type VariantForm = {
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  brandId: string;
  categoryId: string;
  sizeId: string;
  gauge: string;
  unitId: string;
  saleUnit: string;
  baseUnit: string;
  lengthPerPiece: string;
  purchasePrice: string;
  retailPrice: string;
  wholesalePrice: string;
  plumberPrice: string;
  dealerPrice: string;
  lowStockAlertQty: string;
  allowDecimalQty: boolean;
  status: "active" | "inactive";
};

const emptyProductForm: ProductForm = {
  name: "",
  categoryId: "",
  brandId: "",
  description: "",
  status: "active"
};

const emptyVariantForm: VariantForm = {
  productId: "",
  name: "",
  sku: "",
  barcode: "",
  brandId: "",
  categoryId: "",
  sizeId: "",
  gauge: "",
  unitId: "",
  saleUnit: "piece",
  baseUnit: "piece",
  lengthPerPiece: "0",
  purchasePrice: "0",
  retailPrice: "0",
  wholesalePrice: "0",
  plumberPrice: "0",
  dealerPrice: "0",
  lowStockAlertQty: "5",
  allowDecimalQty: false,
  status: "active"
};

const saleUnits = ["piece", "length", "feet", "meter", "box", "carton", "set", "bundle", "dozen"];
const baseUnits = ["piece", "feet", "meter"];

export default function ProductsPage() {
  const [brands, setBrands] = useState<Master[]>([]);
  const [categories, setCategories] = useState<Master[]>([]);
  const [units, setUnits] = useState<Master[]>([]);
  const [sizes, setSizes] = useState<Master[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);

  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [variantForm, setVariantForm] = useState<VariantForm>(emptyVariantForm);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingVariant, setSavingVariant] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    setError("");

    try {
      const [brandRes, categoryRes, unitRes, sizeRes, productRes, variantRes] = await Promise.all([
        api<{ data: Master[] }>("/master/brands"),
        api<{ data: Master[] }>("/master/categories"),
        api<{ data: Master[] }>("/master/units"),
        api<{ data: Master[] }>("/master/sizes"),
        api<{ data: Product[] }>("/products"),
        api<{ data: Variant[] }>("/products/variants")
      ]);

      setBrands(brandRes.data);
      setCategories(categoryRes.data);
      setUnits(unitRes.data);
      setSizes(sizeRes.data);
      setProducts(productRes.data);
      setVariants(variantRes.data);

      setProductForm((prev) => ({
        ...prev,
        brandId: prev.brandId || brandRes.data[0]?._id || "",
        categoryId: prev.categoryId || categoryRes.data[0]?._id || ""
      }));

      setVariantForm((prev) => ({
        ...prev,
        brandId: prev.brandId || brandRes.data[0]?._id || "",
        categoryId: prev.categoryId || categoryRes.data[0]?._id || "",
        unitId: prev.unitId || unitRes.data[0]?._id || "",
        productId: prev.productId || productRes.data[0]?._id || ""
      }));
    } catch (err: any) {
      setError(err.message || "Data load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filteredVariants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return variants;

    return variants.filter((item) => {
      return [
        item.name,
        item.sku,
        item.barcode,
        item.brandId?.name,
        item.categoryId?.name,
        item.sizeId?.name,
        item.gauge,
        item.productId?.name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [variants, search]);

  const productOptions = products.map((product) => ({
    id: product._id,
    label: `${product.name} (${product.brandId?.name || "No Brand"})`
  }));

  const submitProduct = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSavingProduct(true);

    try {
      const payload = {
        name: productForm.name.trim(),
        categoryId: productForm.categoryId,
        brandId: productForm.brandId,
        description: productForm.description.trim(),
        status: productForm.status
      };

      if (editingProductId) {
        await api(`/products/${editingProductId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setMessage("Product updated successfully.");
      } else {
        const res = await api<{ data: Product }>("/products", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setVariantForm((prev) => ({
          ...prev,
          productId: res.data._id,
          brandId: productForm.brandId,
          categoryId: productForm.categoryId
        }));
        setMessage("Product created successfully.");
      }

      setProductForm(emptyProductForm);
      setEditingProductId(null);
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Product save failed");
    } finally {
      setSavingProduct(false);
    }
  };

  const submitVariant = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSavingVariant(true);

    try {
      const payload = {
        productId: variantForm.productId,
        name: variantForm.name.trim(),
        sku: variantForm.sku.trim(),
        barcode: variantForm.barcode.trim() || undefined,
        brandId: variantForm.brandId,
        categoryId: variantForm.categoryId,
        sizeId: variantForm.sizeId || null,
        gauge: variantForm.gauge.trim(),
        unitId: variantForm.unitId,
        saleUnit: variantForm.saleUnit,
        baseUnit: variantForm.baseUnit,
        lengthPerPiece: Number(variantForm.lengthPerPiece || 0),
        purchasePrice: Number(variantForm.purchasePrice || 0),
        retailPrice: Number(variantForm.retailPrice || 0),
        wholesalePrice: Number(variantForm.wholesalePrice || 0),
        plumberPrice: Number(variantForm.plumberPrice || 0),
        dealerPrice: Number(variantForm.dealerPrice || 0),
        lowStockAlertQty: Number(variantForm.lowStockAlertQty || 0),
        allowDecimalQty: variantForm.allowDecimalQty,
        status: variantForm.status
      };

      if (editingVariantId) {
        await api(`/products/variants/${editingVariantId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setMessage("Variant updated successfully.");
      } else {
        await api("/products/variants", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setMessage("Variant created successfully.");
      }

      setVariantForm({
        ...emptyVariantForm,
        brandId: brands[0]?._id || "",
        categoryId: categories[0]?._id || "",
        unitId: units[0]?._id || "",
        productId: products[0]?._id || ""
      });
      setEditingVariantId(null);
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Variant save failed");
    } finally {
      setSavingVariant(false);
    }
  };

  const editProduct = (product: Product) => {
    setEditingProductId(product._id);
    setProductForm({
      name: product.name,
      categoryId: product.categoryId?._id || "",
      brandId: product.brandId?._id || "",
      description: product.description || "",
      status: product.status || "active"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const editVariant = (variant: Variant) => {
    setEditingVariantId(variant._id);
    setVariantForm({
      productId: variant.productId?._id || "",
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode || "",
      brandId: variant.brandId?._id || "",
      categoryId: variant.categoryId?._id || "",
      sizeId: variant.sizeId?._id || "",
      gauge: variant.gauge || "",
      unitId: variant.unitId?._id || "",
      saleUnit: variant.saleUnit || "piece",
      baseUnit: variant.baseUnit || "piece",
      lengthPerPiece: String(variant.lengthPerPiece || 0),
      purchasePrice: String(variant.purchasePrice || 0),
      retailPrice: String(variant.retailPrice || 0),
      wholesalePrice: String(variant.wholesalePrice || 0),
      plumberPrice: String(variant.plumberPrice || 0),
      dealerPrice: String(variant.dealerPrice || 0),
      lowStockAlertQty: String(variant.lowStockAlertQty || 0),
      allowDecimalQty: Boolean(variant.allowDecimalQty),
      status: variant.status || "active"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteProduct = async (product: Product) => {
    const ok = confirm(`Delete product "${product.name}"? Product variants must be deleted first.`);
    if (!ok) return;

    try {
      await api(`/products/${product._id}`, { method: "DELETE" });
      setMessage("Product deleted successfully.");
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Product delete failed");
    }
  };

  const deleteVariant = async (variant: Variant) => {
    const ok = confirm(`Delete variant "${variant.name}"? Variant with stock cannot be deleted.`);
    if (!ok) return;

    try {
      await api(`/products/variants/${variant._id}`, { method: "DELETE" });
      setMessage("Variant deleted successfully.");
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Variant delete failed");
    }
  };

  const autoFillPipeVariant = () => {
    const steelex = brands.find((brand) => brand.name.toLowerCase().includes("steelex"));
    const pipes = categories.find((category) => category.name.toLowerCase().includes("pipe"));
    const lengthUnit = units.find((unit) => unit.name.toLowerCase().includes("length"));
    const size2 = sizes.find((size) => size.name === "2");

    setVariantForm((prev) => ({
      ...prev,
      brandId: steelex?._id || prev.brandId,
      categoryId: pipes?._id || prev.categoryId,
      sizeId: size2?._id || prev.sizeId,
      unitId: lengthUnit?._id || prev.unitId,
      saleUnit: "length",
      baseUnit: "feet",
      lengthPerPiece: "20",
      allowDecimalQty: false,
      lowStockAlertQty: "5"
    }));
  };

  const autoFillFittingVariant = () => {
    const steelex = brands.find((brand) => brand.name.toLowerCase().includes("steelex"));
    const fitting = categories.find((category) => category.name.toLowerCase().includes("fitting"));
    const pieceUnit = units.find((unit) => unit.name.toLowerCase().includes("piece"));
    const size1 = sizes.find((size) => size.name === "1");

    setVariantForm((prev) => ({
      ...prev,
      brandId: steelex?._id || prev.brandId,
      categoryId: fitting?._id || prev.categoryId,
      sizeId: size1?._id || prev.sizeId,
      unitId: pieceUnit?._id || prev.unitId,
      saleUnit: "piece",
      baseUnit: "piece",
      lengthPerPiece: "0",
      allowDecimalQty: false,
      gauge: prev.gauge,
      lowStockAlertQty: "20"
    }));
  };

  return (
    <DashboardLayout title="Products">
      <div className="page-header">
        <div>
          <h2>Products & Variants</h2>
          <p>Pipe, fittings, size, brand, SKU, barcode, retail/plumber/dealer prices manage karo.</p>
        </div>

        <button className="btn btn-light" onClick={loadAll}>
          Refresh
        </button>
      </div>

      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      {loading ? (
        <div className="card">Loading products...</div>
      ) : (
        <>
          <div className="two-column">
            <div className="card">
              <div className="section-title">
                <h3>{editingProductId ? "Edit Product" : "Create Product"}</h3>
                {editingProductId ? (
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => {
                      setEditingProductId(null);
                      setProductForm(emptyProductForm);
                    }}
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>

              <form onSubmit={submitProduct}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Product Name</label>
                    <input
                      className="input"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      placeholder="PVC Pipe, Elbow, Tee, Mixer"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Brand</label>
                    <select
                      className="select"
                      value={productForm.brandId}
                      onChange={(e) => setProductForm({ ...productForm, brandId: e.target.value })}
                      required
                    >
                      <option value="">Select brand</option>
                      {brands.map((brand) => (
                        <option key={brand._id} value={brand._id}>{brand.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <select
                      className="select"
                      value={productForm.categoryId}
                      onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                      required
                    >
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category._id} value={category._id}>{category.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Status</label>
                    <select
                      className="select"
                      value={productForm.status}
                      onChange={(e) => setProductForm({ ...productForm, status: e.target.value as "active" | "inactive" })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>

                <button className="btn" disabled={savingProduct}>
                  {savingProduct ? "Saving..." : editingProductId ? "Update Product" : "Create Product"}
                </button>
              </form>
            </div>

            <div className="card">
              <div className="section-title">
                <h3>Products List</h3>
                <span className="badge">{products.length} items</span>
              </div>

              <div className="table-wrap compact-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Brand</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr><td colSpan={5}>No products found.</td></tr>
                    ) : (
                      products.map((product) => (
                        <tr key={product._id}>
                          <td>{product.name}</td>
                          <td>{product.brandId?.name || "-"}</td>
                          <td>{product.categoryId?.name || "-"}</td>
                          <td><span className="badge">{product.status}</span></td>
                          <td>
                            <div className="row-actions">
                              <button className="small-btn" onClick={() => editProduct(product)}>Edit</button>
                              <button className="small-btn danger-text" onClick={() => deleteProduct(product)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="section-title">
              <h3>{editingVariantId ? "Edit Variant / Sellable Item" : "Create Variant / Sellable Item"}</h3>
              <div className="row-actions">
                <button className="small-btn" type="button" onClick={autoFillPipeVariant}>Pipe 20ft Preset</button>
                <button className="small-btn" type="button" onClick={autoFillFittingVariant}>Fitting Preset</button>
                {editingVariantId ? (
                  <button
                    className="small-btn"
                    type="button"
                    onClick={() => {
                      setEditingVariantId(null);
                      setVariantForm(emptyVariantForm);
                    }}
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </div>

            <form onSubmit={submitVariant}>
              <div className="form-grid variant-grid">
                <div className="form-group">
                  <label>Parent Product</label>
                  <select
                    className="select"
                    value={variantForm.productId}
                    onChange={(e) => setVariantForm({ ...variantForm, productId: e.target.value })}
                    required
                  >
                    <option value="">Select product</option>
                    {productOptions.map((product) => (
                      <option key={product.id} value={product.id}>{product.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Variant Name</label>
                  <input
                    className="input"
                    value={variantForm.name}
                    onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                    placeholder="PVC Pipe 2 inch Steelex"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>SKU</label>
                  <input
                    className="input"
                    value={variantForm.sku}
                    onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value.toUpperCase() })}
                    placeholder="STX-PIPE-2"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Barcode</label>
                  <input
                    className="input"
                    value={variantForm.barcode}
                    onChange={(e) => setVariantForm({ ...variantForm, barcode: e.target.value })}
                    placeholder="Optional barcode"
                  />
                </div>

                <div className="form-group">
                  <label>Brand</label>
                  <select
                    className="select"
                    value={variantForm.brandId}
                    onChange={(e) => setVariantForm({ ...variantForm, brandId: e.target.value })}
                    required
                  >
                    <option value="">Select brand</option>
                    {brands.map((brand) => (
                      <option key={brand._id} value={brand._id}>{brand.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    className="select"
                    value={variantForm.categoryId}
                    onChange={(e) => setVariantForm({ ...variantForm, categoryId: e.target.value })}
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category._id} value={category._id}>{category.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Size</label>
                  <select
                    className="select"
                    value={variantForm.sizeId}
                    onChange={(e) => setVariantForm({ ...variantForm, sizeId: e.target.value })}
                  >
                    <option value="">No size</option>
                    {sizes.map((size) => (
                      <option key={size._id} value={size._id}>{size.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Gauge / Thickness (Optional)</label>
                  <input
                    className="input"
                    value={variantForm.gauge}
                    onChange={(e) => setVariantForm({ ...variantForm, gauge: e.target.value })}
                    placeholder="41, 64, Heavy, Medium"
                  />
                </div>

                <div className="form-group">
                  <label>Unit</label>
                  <select
                    className="select"
                    value={variantForm.unitId}
                    onChange={(e) => setVariantForm({ ...variantForm, unitId: e.target.value })}
                    required
                  >
                    <option value="">Select unit</option>
                    {units.map((unit) => (
                      <option key={unit._id} value={unit._id}>{unit.name} ({unit.shortName})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Sale Unit</label>
                  <select
                    className="select"
                    value={variantForm.saleUnit}
                    onChange={(e) => {
                      const saleUnit = e.target.value;
                      setVariantForm({
                        ...variantForm,
                        saleUnit,
                        baseUnit: saleUnit === "length" ? "feet" : saleUnit === "feet" ? "feet" : "piece",
                        lengthPerPiece: saleUnit === "length" ? "20" : "0",
                        allowDecimalQty: saleUnit === "feet" || saleUnit === "meter"
                      });
                    }}
                  >
                    {saleUnits.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Base Unit</label>
                  <select
                    className="select"
                    value={variantForm.baseUnit}
                    onChange={(e) => setVariantForm({ ...variantForm, baseUnit: e.target.value })}
                  >
                    {baseUnits.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Length Per Piece</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={variantForm.lengthPerPiece}
                    onChange={(e) => setVariantForm({ ...variantForm, lengthPerPiece: e.target.value })}
                    placeholder="20 for pipe"
                  />
                </div>

                <div className="form-group">
                  <label>Low Stock Alert</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={variantForm.lowStockAlertQty}
                    onChange={(e) => setVariantForm({ ...variantForm, lowStockAlertQty: e.target.value })}
                  />
                </div>

                <MoneyInput label="Purchase Price" value={variantForm.purchasePrice} onChange={(value) => setVariantForm({ ...variantForm, purchasePrice: value })} />
                <MoneyInput label="Retail Price" value={variantForm.retailPrice} onChange={(value) => setVariantForm({ ...variantForm, retailPrice: value })} />
                <MoneyInput label="Wholesale Price" value={variantForm.wholesalePrice} onChange={(value) => setVariantForm({ ...variantForm, wholesalePrice: value })} />
                <MoneyInput label="Plumber Price" value={variantForm.plumberPrice} onChange={(value) => setVariantForm({ ...variantForm, plumberPrice: value })} />
                <MoneyInput label="Dealer Price" value={variantForm.dealerPrice} onChange={(value) => setVariantForm({ ...variantForm, dealerPrice: value })} />

                <div className="form-group">
                  <label>Status</label>
                  <select
                    className="select"
                    value={variantForm.status}
                    onChange={(e) => setVariantForm({ ...variantForm, status: e.target.value as "active" | "inactive" })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={variantForm.allowDecimalQty}
                    onChange={(e) => setVariantForm({ ...variantForm, allowDecimalQty: e.target.checked })}
                  />
                  Allow decimal quantity
                </label>
              </div>

              <button className="btn" disabled={savingVariant}>
                {savingVariant ? "Saving..." : editingVariantId ? "Update Variant" : "Create Variant"}
              </button>
            </form>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="section-title">
              <h3>Sellable Items / Variants</h3>
              <span className="badge">{filteredVariants.length} items</span>
            </div>

            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU, barcode, brand, size, category"
              style={{ marginBottom: 14 }}
            />

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>SKU / Barcode</th>
                    <th>Brand</th>
                    <th>Size / Gauge</th>
                    <th>Unit</th>
                    <th>Prices</th>
                    <th>Low Stock</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVariants.length === 0 ? (
                    <tr><td colSpan={8}>No variants found.</td></tr>
                  ) : (
                    filteredVariants.map((variant) => (
                      <tr key={variant._id}>
                        <td>
                          <strong>{variant.name}</strong>
                          <div className="muted-small">{variant.productId?.name || "-"}</div>
                        </td>
                        <td>
                          <strong>{variant.sku}</strong>
                          <div className="muted-small">{variant.barcode || "No barcode"}</div>
                        </td>
                        <td>{variant.brandId?.name || "-"}</td>
                        <td>{variant.sizeId?.name || "-"}<div className="muted-small">Gauge: {variant.gauge || "-"}</div></td>
                        <td>
                          {variant.saleUnit}
                          {variant.lengthPerPiece ? <div className="muted-small">{variant.lengthPerPiece} ft / length</div> : null}
                        </td>
                        <td>
                          <div>Retail: Rs. {Number(variant.retailPrice || 0).toLocaleString()}</div>
                          <div className="muted-small">Plumber: Rs. {Number(variant.plumberPrice || 0).toLocaleString()}</div>
                        </td>
                        <td>{variant.lowStockAlertQty || 0}</td>
                        <td>
                          <div className="row-actions">
                            <button className="small-btn" onClick={() => editVariant(variant)}>Edit</button>
                            <button className="small-btn danger-text" onClick={() => deleteVariant(variant)}>Delete</button>
                          </div>
                        </td>
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

function MoneyInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <input
        className="input"
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
