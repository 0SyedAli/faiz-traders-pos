"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type CustomerType = "walkin" | "regular" | "plumber" | "contractor" | "dealer";

type Customer = {
  _id: string;
  name: string;
  phone?: string;
  address?: string;
  customerType: CustomerType;
  openingBalance: number;
  currentBalance: number;
  status: "active" | "inactive";
  createdAt: string;
};

type Ledger = {
  _id: string;
  type: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  referenceType?: string;
  note?: string;
  createdAt: string;
};

type Summary = {
  totalCustomers: number;
  plumbers: number;
  contractors: number;
  dealers: number;
  totalCredit: number;
};

type CustomerForm = {
  name: string;
  phone: string;
  address: string;
  customerType: CustomerType;
  openingBalance: string;
  status: "active" | "inactive";
};

const emptyCustomerForm: CustomerForm = {
  name: "",
  phone: "",
  address: "",
  customerType: "plumber",
  openingBalance: "0",
  status: "active"
};

const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

const customerTypeLabels: Record<CustomerType, string> = {
  walkin: "Walk-in",
  regular: "Regular",
  plumber: "Plumber",
  contractor: "Contractor",
  dealer: "Dealer"
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalCustomers: 0,
    plumbers: 0,
    contractors: 0,
    dealers: 0,
    totalCredit: 0
  });

  const [form, setForm] = useState<CustomerForm>(emptyCustomerForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<Ledger[]>([]);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNote, setPaymentNote] = useState("");

  const [adjustmentType, setAdjustmentType] = useState<"debit" | "credit">("debit");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadCustomers = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (typeFilter) params.set("type", typeFilter);

      const [customerRes, summaryRes] = await Promise.all([
        api<{ data: Customer[] }>(`/customers?${params.toString()}`),
        api<{ data: Summary }>("/customers/summary")
      ]);

      setCustomers(customerRes.data);
      setSummary(summaryRes.data);
    } catch (err: any) {
      setError(err.message || "Customers load failed");
    } finally {
      setLoading(false);
    }
  };

  const loadLedger = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setError("");

    try {
      const res = await api<{ data: { customer: Customer; ledger: Ledger[] } }>(
        `/customers/${customer._id}/ledger`
      );

      setSelectedCustomer(res.data.customer);
      setLedger(res.data.ledger);
    } catch (err: any) {
      setError(err.message || "Ledger load failed");
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => customers, [customers]);

  const submitCustomer = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSavingCustomer(true);

    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        customerType: form.customerType,
        openingBalance: Number(form.openingBalance || 0),
        status: form.status
      };

      if (editingId) {
        await api(`/customers/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setMessage("Customer updated successfully.");
      } else {
        await api("/customers", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setMessage("Customer/plumber created successfully.");
      }

      setEditingId(null);
      setForm(emptyCustomerForm);
      await loadCustomers();

      if (selectedCustomer) {
        const fresh = await api<{ data: { customer: Customer; ledger: Ledger[] } }>(
          `/customers/${selectedCustomer._id}/ledger`
        );
        setSelectedCustomer(fresh.data.customer);
        setLedger(fresh.data.ledger);
      }
    } catch (err: any) {
      setError(err.message || "Customer save failed");
    } finally {
      setSavingCustomer(false);
    }
  };

  const editCustomer = (customer: Customer) => {
    setEditingId(customer._id);
    setForm({
      name: customer.name,
      phone: customer.phone || "",
      address: customer.address || "",
      customerType: customer.customerType || "regular",
      openingBalance: String(customer.openingBalance || 0),
      status: customer.status || "active"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteCustomer = async (customer: Customer) => {
    const ok = confirm(`Delete "${customer.name}"? Customers with balance/sales cannot be deleted.`);
    if (!ok) return;

    try {
      await api(`/customers/${customer._id}`, { method: "DELETE" });
      setMessage("Customer deleted successfully.");

      if (selectedCustomer?._id === customer._id) {
        setSelectedCustomer(null);
        setLedger([]);
      }

      await loadCustomers();
    } catch (err: any) {
      setError(err.message || "Customer delete failed");
    }
  };

  const submitPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer) return;

    setMessage("");
    setError("");
    setSavingPayment(true);

    try {
      await api(`/customers/${selectedCustomer._id}/receive-payment`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(paymentAmount || 0),
          paymentMethod,
          note: paymentNote
        })
      });

      setPaymentAmount("");
      setPaymentNote("");
      setMessage("Customer payment received.");
      await loadCustomers();
      await loadLedger(selectedCustomer);
    } catch (err: any) {
      setError(err.message || "Payment save failed");
    } finally {
      setSavingPayment(false);
    }
  };

  const submitAdjustment = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer) return;

    setMessage("");
    setError("");
    setSavingAdjustment(true);

    try {
      await api(`/customers/${selectedCustomer._id}/adjustment`, {
        method: "POST",
        body: JSON.stringify({
          adjustmentType,
          amount: Number(adjustmentAmount || 0),
          note: adjustmentNote
        })
      });

      setAdjustmentAmount("");
      setAdjustmentNote("");
      setMessage("Customer balance adjusted.");
      await loadCustomers();
      await loadLedger(selectedCustomer);
    } catch (err: any) {
      setError(err.message || "Adjustment failed");
    } finally {
      setSavingAdjustment(false);
    }
  };

  return (
    <DashboardLayout title="Customers / Plumbers">
      <div className="page-header">
        <div>
          <h2>Customers / Plumbers Khata</h2>
          <p>Plumbers, contractors, dealers aur regular customers ka udhaar/khata manage karo.</p>
        </div>

        <button className="btn btn-light" onClick={loadCustomers}>
          Refresh
        </button>
      </div>

      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      <div className="grid stats-grid">
        <Stat title="Total Customers" value={String(summary.totalCustomers)} />
        <Stat title="Plumbers" value={String(summary.plumbers)} />
        <Stat title="Contractors" value={String(summary.contractors)} />
        <Stat title="Dealers" value={String(summary.dealers)} />
        <Stat title="Total Khata / Udhaar" value={money(summary.totalCredit)} />
      </div>

      <div className="two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="section-title">
            <h3>{editingId ? "Edit Customer" : "Create Customer / Plumber"}</h3>
            {editingId ? (
              <button
                className="small-btn"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyCustomerForm);
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>

          <form onSubmit={submitCustomer}>
            <div className="form-grid">
              <div className="form-group">
                <label>Name</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ali Plumber"
                  required
                />
              </div>

              <div className="form-group">
                <label>Phone</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0300..."
                />
              </div>

              <div className="form-group">
                <label>Customer Type</label>
                <select
                  className="select"
                  value={form.customerType}
                  onChange={(e) => setForm({ ...form, customerType: e.target.value as CustomerType })}
                >
                  <option value="regular">Regular</option>
                  <option value="plumber">Plumber</option>
                  <option value="contractor">Contractor</option>
                  <option value="dealer">Dealer</option>
                </select>
              </div>

              <div className="form-group">
                <label>Opening Balance</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={form.openingBalance}
                  onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                  disabled={Boolean(editingId)}
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  className="select"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Address / Notes</label>
              <textarea
                className="input"
                rows={3}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Address, area, site notes"
              />
            </div>

            <button className="btn" disabled={savingCustomer}>
              {savingCustomer ? "Saving..." : editingId ? "Update Customer" : "Create Customer"}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="section-title">
            <h3>Customer List</h3>
            <span className="badge">{filteredCustomers.length} customers</span>
          </div>

          <div className="filter-row">
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, area"
            />

            <select
              className="select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All types</option>
              <option value="walkin">Walk-in</option>
              <option value="regular">Regular</option>
              <option value="plumber">Plumber</option>
              <option value="contractor">Contractor</option>
              <option value="dealer">Dealer</option>
            </select>

            <button className="btn btn-light" onClick={loadCustomers}>
              Search
            </button>
          </div>

          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5}>Loading...</td></tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr><td colSpan={5}>No customers found.</td></tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer._id}>
                      <td>
                        <strong>{customer.name}</strong>
                        <div className="muted-small">{customer.phone || "No phone"}</div>
                      </td>
                      <td>{customerTypeLabels[customer.customerType] || customer.customerType}</td>
                      <td>
                        <strong className={customer.currentBalance > 0 ? "danger-text" : ""}>
                          {money(customer.currentBalance)}
                        </strong>
                      </td>
                      <td><span className="badge">{customer.status}</span></td>
                      <td>
                        <div className="row-actions">
                          <button className="small-btn" onClick={() => loadLedger(customer)}>Ledger</button>
                          <button className="small-btn" onClick={() => editCustomer(customer)}>Edit</button>
                          {customer.customerType !== "walkin" ? (
                            <button className="small-btn danger-text" onClick={() => deleteCustomer(customer)}>Delete</button>
                          ) : null}
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

      {selectedCustomer ? (
        <>
          <div className="card customer-profile-card" style={{ marginTop: 18 }}>
            <div>
              <h3>{selectedCustomer.name}</h3>
              <p>
                {customerTypeLabels[selectedCustomer.customerType]} • {selectedCustomer.phone || "No phone"} • Balance:
                <strong className="danger-text"> {money(selectedCustomer.currentBalance)}</strong>
              </p>
            </div>
            <button className="btn btn-light" onClick={() => loadLedger(selectedCustomer)}>
              Refresh Ledger
            </button>
          </div>

          <div className="two-column" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="section-title">
                <h3>Receive Payment</h3>
                <span className="badge">Credit / Khata</span>
              </div>

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
                      placeholder="Received amount"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Method</label>
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
                    placeholder="Cash received from plumber"
                  />
                </div>

                <button className="btn" disabled={savingPayment}>
                  {savingPayment ? "Saving..." : "Save Payment"}
                </button>
              </form>
            </div>

            <div className="card">
              <div className="section-title">
                <h3>Manual Adjustment</h3>
                <span className="badge">Debit / Credit</span>
              </div>

              <form onSubmit={submitAdjustment}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Adjustment Type</label>
                    <select
                      className="select"
                      value={adjustmentType}
                      onChange={(e) => setAdjustmentType(e.target.value as "debit" | "credit")}
                    >
                      <option value="debit">Debit — Balance Increase</option>
                      <option value="credit">Credit — Balance Decrease</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Amount</label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Reason / Note</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={adjustmentNote}
                    onChange={(e) => setAdjustmentNote(e.target.value)}
                    placeholder="Example: old bill correction, return adjustment, extra charge"
                    required
                  />
                </div>

                <button className="btn" disabled={savingAdjustment}>
                  {savingAdjustment ? "Saving..." : "Save Adjustment"}
                </button>
              </form>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="section-title">
              <h3>Ledger History</h3>
              <span className="badge">{ledger.length} entries</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th>Balance</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.length === 0 ? (
                    <tr><td colSpan={6}>No ledger entries.</td></tr>
                  ) : (
                    ledger.map((row) => (
                      <tr key={row._id}>
                        <td>{new Date(row.createdAt).toLocaleString()}</td>
                        <td>{row.type}</td>
                        <td>{money(row.debit)}</td>
                        <td>{money(row.credit)}</td>
                        <td><strong>{money(row.balanceAfter)}</strong></td>
                        <td>{row.note || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ marginTop: 18 }}>
          <p className="placeholder">
            Ledger dekhne ke liye customer/plumber row me <strong>Ledger</strong> button click karo.
            POS sale ke baad khata entries yahin show hongi.
          </p>
        </div>
      )}
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
