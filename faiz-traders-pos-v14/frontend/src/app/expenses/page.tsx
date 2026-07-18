"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Category = {
  _id: string;
  name: string;
  status: "active" | "inactive";
};

type Expense = {
  _id: string;
  categoryId?: Category;
  title: string;
  amount: number;
  paymentMethod: string;
  expenseDate: string;
  note?: string;
};

type ExpenseForm = {
  categoryId: string;
  title: string;
  amount: string;
  paymentMethod: string;
  expenseDate: string;
  note: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;

const emptyExpenseForm: ExpenseForm = {
  categoryId: "",
  title: "",
  amount: "0",
  paymentMethod: "cash",
  expenseDate: today(),
  note: ""
};

export default function ExpensesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState<ExpenseForm>(emptyExpenseForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [categoryName, setCategoryName] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(today());

  const [loading, setLoading] = useState(true);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (categoryFilter) params.set("categoryId", categoryFilter);

      const [categoryRes, expenseRes] = await Promise.all([
        api<{ data: Category[] }>("/expenses/categories"),
        api<{ data: Expense[] }>(`/expenses?${params.toString()}`)
      ]);

      setCategories(categoryRes.data);
      setExpenses(expenseRes.data);

      setForm((prev) => ({
        ...prev,
        categoryId: prev.categoryId || categoryRes.data[0]?._id || ""
      }));
    } catch (err: any) {
      setError(err.message || "Expenses load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const totals = useMemo(() => {
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

    const byMethod = expenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.paymentMethod] = (acc[expense.paymentMethod] || 0) + Number(expense.amount || 0);
      return acc;
    }, {});

    return { total, count: expenses.length, byMethod };
  }, [expenses]);

  const submitCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryName.trim()) return;

    setMessage("");
    setError("");
    setSavingCategory(true);

    try {
      await api("/expenses/categories", {
        method: "POST",
        body: JSON.stringify({ name: categoryName.trim(), status: "active" })
      });
      setCategoryName("");
      setMessage("Expense category created.");
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Category save failed");
    } finally {
      setSavingCategory(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    const ok = confirm(`Delete category "${category.name}"? Used categories cannot be deleted.`);
    if (!ok) return;

    try {
      await api(`/expenses/categories/${category._id}`, { method: "DELETE" });
      setMessage("Category deleted.");
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Category delete failed");
    }
  };

  const submitExpense = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSavingExpense(true);

    try {
      const payload = {
        categoryId: form.categoryId,
        title: form.title.trim(),
        amount: Number(form.amount || 0),
        paymentMethod: form.paymentMethod,
        expenseDate: form.expenseDate,
        note: form.note.trim()
      };

      if (editingId) {
        await api(`/expenses/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setMessage("Expense updated successfully.");
      } else {
        await api("/expenses", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setMessage("Expense created successfully.");
      }

      setForm({
        ...emptyExpenseForm,
        categoryId: categories[0]?._id || ""
      });
      setEditingId(null);
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Expense save failed");
    } finally {
      setSavingExpense(false);
    }
  };

  const editExpense = (expense: Expense) => {
    setEditingId(expense._id);
    setForm({
      categoryId: expense.categoryId?._id || "",
      title: expense.title,
      amount: String(expense.amount || 0),
      paymentMethod: expense.paymentMethod || "cash",
      expenseDate: new Date(expense.expenseDate).toISOString().slice(0, 10),
      note: expense.note || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteExpense = async (expense: Expense) => {
    const ok = confirm(`Delete expense "${expense.title}"?`);
    if (!ok) return;

    try {
      await api(`/expenses/${expense._id}`, { method: "DELETE" });
      setMessage("Expense deleted.");
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Expense delete failed");
    }
  };

  return (
    <DashboardLayout title="Expenses">
      <div className="page-header">
        <div>
          <h2>Expenses</h2>
          <p>Rent, electricity, salary, transport, loading/unloading, repairs aur other expenses.</p>
        </div>

        <button className="btn btn-light" onClick={loadAll}>
          Refresh
        </button>
      </div>

      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      <div className="grid stats-grid">
        <Stat title="Total Expenses" value={money(totals.total)} />
        <Stat title="Entries" value={String(totals.count)} />
        <Stat title="Cash Expenses" value={money(totals.byMethod.cash || 0)} />
        <Stat title="Bank Expenses" value={money(totals.byMethod.bank || 0)} />
      </div>

      <div className="two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="section-title">
            <h3>{editingId ? "Edit Expense" : "Add Expense"}</h3>
            {editingId ? (
              <button
                className="small-btn"
                onClick={() => {
                  setEditingId(null);
                  setForm({ ...emptyExpenseForm, categoryId: categories[0]?._id || "" });
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>

          <form onSubmit={submitExpense}>
            <div className="form-grid">
              <div className="form-group">
                <label>Category</label>
                <select
                  className="select"
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>{category.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Expense Date</label>
                <input
                  className="input"
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Title</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Shop rent, electricity bill, loading"
                  required
                />
              </div>

              <div className="form-group">
                <label>Amount</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <select
                  className="select"
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
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
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Optional detail"
              />
            </div>

            <button className="btn" disabled={savingExpense}>
              {savingExpense ? "Saving..." : editingId ? "Update Expense" : "Add Expense"}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="section-title">
            <h3>Expense Categories</h3>
            <span className="badge">{categories.length} categories</span>
          </div>

          <form onSubmit={submitCategory} className="inline-form">
            <input
              className="input"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="New category name"
            />
            <button className="btn" disabled={savingCategory}>
              Add
            </button>
          </form>

          <div className="category-list">
            {categories.map((category) => (
              <div className="category-pill" key={category._id}>
                <span>{category.name}</span>
                <button className="pill-x" onClick={() => deleteCategory(category)}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-title">
          <h3>Expense List</h3>
          <span className="badge">{expenses.length} entries</span>
        </div>

        <div className="filter-row reports-filter">
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <select
            className="select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>{category.name}</option>
            ))}
          </select>
          <button className="btn btn-light" onClick={loadAll}>Apply</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Category</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Note</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>Loading...</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={7}>No expenses found.</td></tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense._id}>
                    <td>{new Date(expense.expenseDate).toLocaleDateString()}</td>
                    <td><strong>{expense.title}</strong></td>
                    <td>{expense.categoryId?.name || "-"}</td>
                    <td>{expense.paymentMethod}</td>
                    <td>{money(expense.amount)}</td>
                    <td>{expense.note || "-"}</td>
                    <td>
                      <div className="row-actions">
                        <button className="small-btn" onClick={() => editExpense(expense)}>Edit</button>
                        <button className="small-btn danger-text" onClick={() => deleteExpense(expense)}>Delete</button>
                      </div>
                    </td>
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

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="card">
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
