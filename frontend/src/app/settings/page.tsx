"use client";

import { FormEvent, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Settings = {
  _id: string;
  businessName: string;
  phone: string;
  address: string;
  currency: string;
  invoicePrefix: string;
  purchasePrefix: string;
  quotationPrefix: string;
  taxEnabled: boolean;
  defaultTaxPercentage: number;
};

type Master = {
  _id: string;
  name: string;
  shortName?: string;
  type?: string;
  allowDecimal?: boolean;
  sortOrder?: number;
  status?: string;
};

const emptySettings: Settings = {
  _id: "",
  businessName: "Faiz Traders",
  phone: "",
  address: "",
  currency: "PKR",
  invoicePrefix: "INV",
  purchasePrefix: "PUR",
  quotationPrefix: "QTN",
  taxEnabled: false,
  defaultTaxPercentage: 0
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [brands, setBrands] = useState<Master[]>([]);
  const [categories, setCategories] = useState<Master[]>([]);
  const [units, setUnits] = useState<Master[]>([]);
  const [sizes, setSizes] = useState<Master[]>([]);
  const [warehouses, setWarehouses] = useState<Master[]>([]);

  const [brandName, setBrandName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [sizeName, setSizeName] = useState("");
  const [unitForm, setUnitForm] = useState({ name: "", shortName: "", allowDecimal: false });
  const [warehouseForm, setWarehouseForm] = useState({ name: "", type: "godown", address: "" });

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    setError("");

    try {
      const [settingsRes, brandRes, categoryRes, unitRes, sizeRes, warehouseRes] = await Promise.all([
        api<{ data: Settings }>("/settings"),
        api<{ data: Master[] }>("/master/brands"),
        api<{ data: Master[] }>("/master/categories"),
        api<{ data: Master[] }>("/master/units"),
        api<{ data: Master[] }>("/master/sizes"),
        api<{ data: Master[] }>("/master/warehouses")
      ]);

      setSettings(settingsRes.data);
      setBrands(brandRes.data);
      setCategories(categoryRes.data);
      setUnits(unitRes.data);
      setSizes(sizeRes.data);
      setWarehouses(warehouseRes.data);
    } catch (err: any) {
      setError(err.message || "Settings load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSavingSettings(true);

    try {
      const res = await api<{ data: Settings }>("/settings", {
        method: "PUT",
        body: JSON.stringify({
          businessName: settings.businessName,
          phone: settings.phone,
          address: settings.address,
          currency: settings.currency,
          invoicePrefix: settings.invoicePrefix,
          purchasePrefix: settings.purchasePrefix,
          quotationPrefix: settings.quotationPrefix,
          taxEnabled: settings.taxEnabled,
          defaultTaxPercentage: Number(settings.defaultTaxPercentage || 0)
        })
      });

      setSettings(res.data);
      setMessage("Business settings updated.");
    } catch (err: any) {
      setError(err.message || "Settings save failed");
    } finally {
      setSavingSettings(false);
    }
  };

  const createMaster = async (
    path: string,
    payload: Record<string, any>,
    reset: () => void
  ) => {
    setMessage("");
    setError("");

    try {
      await api(path, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      reset();
      setMessage("Saved successfully.");
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Save failed");
    }
  };

  const deleteMaster = async (path: string, name: string) => {
    const ok = confirm(`Delete "${name}"? Used records may fail to delete.`);
    if (!ok) return;

    setMessage("");
    setError("");

    try {
      await api(path, { method: "DELETE" });
      setMessage("Deleted successfully.");
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Delete failed");
    }
  };

  return (
    <DashboardLayout title="Settings">
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Business information, invoice prefixes, brands, categories, units, sizes aur godowns.</p>
        </div>

        <button className="btn btn-light" onClick={loadAll}>
          Refresh
        </button>
      </div>

      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      {loading ? (
        <div className="card">Loading settings...</div>
      ) : (
        <>
          <div className="card">
            <div className="section-title">
              <h3>Business Settings</h3>
              <span className="badge">Invoice Setup</span>
            </div>

            <form onSubmit={saveSettings}>
              <div className="form-grid">
                <Field label="Business Name">
                  <input
                    className="input"
                    value={settings.businessName}
                    onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Phone">
                  <input
                    className="input"
                    value={settings.phone || ""}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  />
                </Field>

                <Field label="Currency">
                  <input
                    className="input"
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Invoice Prefix">
                  <input
                    className="input"
                    value={settings.invoicePrefix}
                    onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value.toUpperCase() })}
                    required
                  />
                </Field>

                <Field label="Purchase Prefix">
                  <input
                    className="input"
                    value={settings.purchasePrefix}
                    onChange={(e) => setSettings({ ...settings, purchasePrefix: e.target.value.toUpperCase() })}
                    required
                  />
                </Field>

                <Field label="Quotation Prefix">
                  <input
                    className="input"
                    value={settings.quotationPrefix}
                    onChange={(e) => setSettings({ ...settings, quotationPrefix: e.target.value.toUpperCase() })}
                    required
                  />
                </Field>

                <Field label="Tax Enabled">
                  <select
                    className="select"
                    value={settings.taxEnabled ? "yes" : "no"}
                    onChange={(e) => setSettings({ ...settings, taxEnabled: e.target.value === "yes" })}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>

                <Field label="Default Tax %">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={settings.defaultTaxPercentage}
                    onChange={(e) => setSettings({ ...settings, defaultTaxPercentage: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <Field label="Address">
                <textarea
                  className="input"
                  rows={3}
                  value={settings.address || ""}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="Shop address"
                />
              </Field>

              <button className="btn" disabled={savingSettings}>
                {savingSettings ? "Saving..." : "Save Settings"}
              </button>
            </form>
          </div>

          <div className="two-column" style={{ marginTop: 18 }}>
            <MasterCard
              title="Brands"
              items={brands}
              input={
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!brandName.trim()) return;
                    createMaster("/master/brands", { name: brandName.trim() }, () => setBrandName(""));
                  }}
                >
                  <input className="input" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Steelex, Pak Arab" />
                  <button className="btn">Add</button>
                </form>
              }
              onDelete={(item) => deleteMaster(`/master/brands/${item._id}`, item.name)}
            />

            <MasterCard
              title="Categories"
              items={categories}
              input={
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!categoryName.trim()) return;
                    createMaster("/master/categories", { name: categoryName.trim() }, () => setCategoryName(""));
                  }}
                >
                  <input className="input" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Pipes, fittings, taps" />
                  <button className="btn">Add</button>
                </form>
              }
              onDelete={(item) => deleteMaster(`/master/categories/${item._id}`, item.name)}
            />

            <MasterCard
              title="Sizes"
              items={sizes}
              input={
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!sizeName.trim()) return;
                    createMaster("/master/sizes", { name: sizeName.trim(), sortOrder: sizes.length + 1 }, () => setSizeName(""));
                  }}
                >
                  <input className="input" value={sizeName} onChange={(e) => setSizeName(e.target.value)} placeholder="1/2, 3/4, 1, 2" />
                  <button className="btn">Add</button>
                </form>
              }
              onDelete={(item) => deleteMaster(`/master/sizes/${item._id}`, item.name)}
            />

            <div className="card">
              <div className="section-title">
                <h3>Units</h3>
                <span className="badge">{units.length}</span>
              </div>

              <form
                className="unit-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!unitForm.name.trim() || !unitForm.shortName.trim()) return;
                  createMaster(
                    "/master/units",
                    {
                      name: unitForm.name.trim(),
                      shortName: unitForm.shortName.trim(),
                      allowDecimal: unitForm.allowDecimal
                    },
                    () => setUnitForm({ name: "", shortName: "", allowDecimal: false })
                  );
                }}
              >
                <input className="input" value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })} placeholder="Unit name" />
                <input className="input" value={unitForm.shortName} onChange={(e) => setUnitForm({ ...unitForm, shortName: e.target.value })} placeholder="Short name" />
                <label className="small-check">
                  <input type="checkbox" checked={unitForm.allowDecimal} onChange={(e) => setUnitForm({ ...unitForm, allowDecimal: e.target.checked })} />
                  Decimal
                </label>
                <button className="btn">Add</button>
              </form>

              <div className="category-list">
                {units.map((item) => (
                  <div className="category-pill" key={item._id}>
                    <span>{item.name} ({item.shortName})</span>
                    <button className="pill-x" onClick={() => deleteMaster(`/master/units/${item._id}`, item.name)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="section-title">
              <h3>Warehouses / Godowns</h3>
              <span className="badge">{warehouses.length} locations</span>
            </div>

            <form
              className="warehouse-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!warehouseForm.name.trim()) return;
                createMaster(
                  "/master/warehouses",
                  warehouseForm,
                  () => setWarehouseForm({ name: "", type: "godown", address: "" })
                );
              }}
            >
              <input className="input" value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} placeholder="Godown 2" />
              <select className="select" value={warehouseForm.type} onChange={(e) => setWarehouseForm({ ...warehouseForm, type: e.target.value })}>
                <option value="shop">Shop</option>
                <option value="godown">Godown</option>
              </select>
              <input className="input" value={warehouseForm.address} onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })} placeholder="Address optional" />
              <button className="btn">Add Location</button>
            </form>

            <div className="table-wrap compact-table" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Address</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.map((item) => (
                    <tr key={item._id}>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.type}</td>
                      <td>{(item as any).address || "-"}</td>
                      <td>
                        <button className="small-btn danger-text" onClick={() => deleteMaster(`/master/warehouses/${item._id}`, item.name)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {children}
    </div>
  );
}

function MasterCard({
  title,
  items,
  input,
  onDelete
}: {
  title: string;
  items: Master[];
  input: React.ReactNode;
  onDelete: (item: Master) => void;
}) {
  return (
    <div className="card">
      <div className="section-title">
        <h3>{title}</h3>
        <span className="badge">{items.length}</span>
      </div>

      {input}

      <div className="category-list">
        {items.map((item) => (
          <div className="category-pill" key={item._id}>
            <span>{item.name}</span>
            <button className="pill-x" onClick={() => onDelete(item)}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
