"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@mystore.com");
  const [password, setPassword] = useState("admin123456");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already logged in redirect
  useEffect(() => {
    const token = localStorage.getItem("my_store_token");
    if (token) router.replace("/dashboard");
  }, [router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api<{
        data: {
          token: string;
          admin: { id: string; name: string; email: string; role: string };
        };
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      localStorage.setItem("my_store_token", res.data.token);
      localStorage.setItem("my_store_admin", JSON.stringify(res.data.admin));
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>Admin Login</h1>
        <p>My Store sanitary POS + mini ERP</p>

        {error ? <div className="error">{error}</div> : null}

        <div className="form-group">
          <label>Email</label>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@mystore.com"
          />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="admin123456"
          />
        </div>

        <button className="btn" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </main>
  );
}
