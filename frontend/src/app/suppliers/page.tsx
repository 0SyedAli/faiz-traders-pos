"use client";

import { FormEvent, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Supplier = {
  _id: string;
  name: string;
  phone?: string;
  address?: string;
  openingBalance: number;
  currentBalance: number;
  status: "active" | "inactive";
};

type Ledger = {
  _id: string;
  type: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  note?: string;
  createdAt: string;
};

type SupplierForm = {
  name: string;
  phone: string;
  address: string;
  openingBalance: string;
  status: "active" | "inactive";
};

const emptySupplierForm: SupplierForm = {
  name: "",
  phone: "",
  address: "",
  openingBalance: "0",
  status: "active"
};

const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplierForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNote, setPaymentNote] = useState("");

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSuppliers = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api<{ data: Supplier[] }>(
        `/suppliers${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`
      );
      setSuppliers(res.data);
    } catch (err: any) {
      setError(err.message || "Suppliers load failed");
    } finally {
      setLoading(false);
    }
  };

  const loadLedger = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setError("");

    try {
      const res = await api<{ data: { supplier: Supplier; ledger: Ledger[] } }>(
        `/suppliers/${supplier._id}/ledger`
      );
      setSelectedSupplier(res.data.supplier);
      setLedger(res.data.ledger);
    } catch (err: any) {
      setError(err.message || "Ledger load failed");
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const submitSupplier = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSavingSupplier(true);

    try {
      const payload = {
        name: supplierForm.name.trim(),
        phone: supplierForm.phone.trim(),
        address: supplierForm.address.trim(),
        openingBalance: Number(supplierForm.openingBalance || 0),
        status: supplierForm.status
      };

      if (editingId) {
        await api(`/suppliers/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setMessage("Supplier updated successfully.");
      } else {
        await api("/suppliers", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setMessage("Supplier created successfully.");
      }

      setSupplierForm(emptySupplierForm);
      setEditingId(null);
      await loadSuppliers();
    } catch (err: any) {
      setError(err.message || "Supplier save failed");
    } finally {
      setSavingSupplier(false);
    }
  };

  const editSupplier = (supplier: Supplier) => {
    setEditingId(supplier._id);
    setSupplierForm({
      name: supplier.name,
      phone: supplier.phone || "",
      address: supplier.address || "",
      openingBalance: String(supplier.openingBalance || 0),
      status: supplier.status || "active"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteSupplier = async (supplier: Supplier) => {
    const ok = confirm(`Delete supplier "${supplier.name}"? Suppliers with balance/history cannot be deleted.`);
    if (!ok) return;

    try {
      await api(`/suppliers/${supplier._id}`, { method: "DELETE" });
      setMessage("Supplier deleted successfully.");
      if (selectedSupplier?._id === supplier._id) {
        setSelectedSupplier(null);
        setLedger([]);
      }
      await loadSuppliers();
    } catch (err: any) {
      setError(err.message || "Supplier delete failed");
    }
  };

  const submitPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedSupplier) return;

    setMessage("");
    setError("");
    setSavingPayment(true);

    try {
      await api(`/suppliers/${selectedSupplier._id}/pay`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(paymentAmount || 0),
          paymentMethod,
          note: paymentNote
        })
      });

      setMessage("Supplier payment saved successfully.");
      setPaymentAmount("");
      setPaymentNote("");
      await loadSuppliers();
      await loadLedger(selectedSupplier);
    } catch (err: any) {
      setError(err.message || "Supplier payment failed");
    } finally {
      setSavingPayment(false);
    }
  };

  const totalPayable = suppliers.reduce((sum, supplier) => sum + Number(supplier.currentBalance || 0), 0);

  return (
    <DashboardLayout title="Suppliers">
      <div className="page-header">
        <div>
          <h2>Suppliers & Payable Ledger</h2>
          <p>Steelex, Pak Arab, Aerofit aur other suppliers ka payable, payments aur ledger.</p>
        </div>

        <button className="btn btn-light" onClick={loadSuppliers}>
          Refresh
        </button>
      </div>

      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      <div className="grid stats-grid">
        <Stat title="Total Suppliers" value={String(suppliers.length)} />
        <Stat title="Supplier Payable" value={money(totalPayable)} />
      </div>

      <div className="two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="section-title">
            <h3>{editingId ? "Edit Supplier" : "Create Supplier"}</h3>
            {editingId ? (
              <button
                className="small-btn"
                onClick={() => {
                  setEditingId(null);
                  setSupplierForm(emptySupplierForm);
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>

          <form onSubmit={submitSupplier}>
            <div className="form-grid">
              <div className="form-group">
                <label>Supplier Name</label>
                <input
                  className="input"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder="Steelex Supplier"
                  required
                />
              </div>

              <div className="form-group">
                <label>Phone</label>
                <input
                  className="input"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  placeholder="0300..."
                />
              </div>

              <div className="form-group">
                <label>Opening Payable Balance</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={supplierForm.openingBalance}
                  onChange={(e) => setSupplierForm({ ...supplierForm, openingBalance: e.target.value })}
                  disabled={Boolean(editingId)}
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  className="select"
                  value={supplierForm.status}
                  onChange={(e) => setSupplierForm({ ...supplierForm, status: e.target.value as "active" | "inactive" })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Address</label>
              <textarea
                className="input"
                rows={3}
                value={supplierForm.address}
                onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                placeholder="Supplier address"
              />
            </div>

            <button className="btn" disabled={savingSupplier}>
              {savingSupplier ? "Saving..." : editingId ? "Update Supplier" : "Create Supplier"}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="section-title">
            <h3>Supplier List</h3>
            <span className="badge">{suppliers.length} suppliers</span>
          </div>

          <div className="filter-row">
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search supplier name or phone"
            />
            <button className="btn btn-light" onClick={loadSuppliers}>
              Search
            </button>
          </div>

          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Payable</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4}>Loading...</td></tr>
                ) : suppliers.length === 0 ? (
                  <tr><td colSpan={4}>No suppliers found.</td></tr>
                ) : (
                  suppliers.map((supplier) => (
                    <tr key={supplier._id}>
                      <td>
                        <strong>{supplier.name}</strong>
                        <div className="muted-small">{supplier.phone || "No phone"}</div>
                      </td>
                      <td>{money(supplier.currentBalance)}</td>
                      <td><span className="badge">{supplier.status}</span></td>
                      <td>
                        <div className="row-actions">
                          <button className="small-btn" onClick={() => loadLedger(supplier)}>Ledger</button>
                          <button className="small-btn" onClick={() => editSupplier(supplier)}>Edit</button>
                          <button className="small-btn danger-text" onClick={() => deleteSupplier(supplier)}>Delete</button>
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

      {selectedSupplier ? (
        <div className="two-column" style={{ marginTop: 18 }}>
          <div className="card">
            <div className="section-title">
              <h3>Pay Supplier</h3>
              <span className="badge">{selectedSupplier.name}</span>
            </div>

            <p className="placeholder">
              Current payable: <strong>{money(selectedSupplier.currentBalance)}</strong>
            </p>

            <form onSubmit={submitPayment}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Amount</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Payment amount"
                    required
                  />
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
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Note</label>
                <textarea
                  className="input"
                  rows={3}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Cash payment / cheque number / bank transfer details"
                />
              </div>

              <button className="btn" disabled={savingPayment}>
                {savingPayment ? "Saving..." : "Save Payment"}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="section-title">
              <h3>Supplier Ledger</h3>
              <span className="badge">{ledger.length} entries</span>
            </div>

            <div className="table-wrap compact-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Debit / Paid</th>
                    <th>Credit / Purchase</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.length === 0 ? (
                    <tr><td colSpan={5}>No ledger entries.</td></tr>
                  ) : (
                    ledger.map((row) => (
                      <tr key={row._id}>
                        <td>
                          {new Date(row.createdAt).toLocaleDateString()}
                          <div className="muted-small">{row.note || ""}</div>
                        </td>
                        <td>{row.type}</td>
                        <td>{money(row.debit)}</td>
                        <td>{money(row.credit)}</td>
                        <td><strong>{money(row.balanceAfter)}</strong></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="card">
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
