"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearLocalSession, getToken } from "@/lib/api";
import { cacheOfflineLogin, verifyOfflineLogin } from "@/lib/offline-auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@mystore.com");
  const [password, setPassword] = useState("admin123456");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let cancelled = false;

    const validateExistingSession = async () => {
      try {
        await api("/auth/me");
        if (!cancelled) router.replace("/dashboard");
      } catch (error) {
        if (error instanceof Error && error.message.includes("unreachable")) {
          if (!cancelled) router.replace("/dashboard");
          return;
        }
        clearLocalSession();
      }
    };

    void validateExistingSession();
    return () => { cancelled = true; };
  }, [router]);

  const saveSession = (token: string, admin: { id: string; name: string; email: string; role: string }) => {
    localStorage.setItem("my_store_token", token);
    localStorage.setItem("my_store_admin", JSON.stringify(admin));
    window.dispatchEvent(new CustomEvent("my-store-auth-changed"));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const response = await api<{
        data: {
          token: string;
          admin: { id: string; name: string; email: string; role: string };
        };
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      saveSession(response.data.token, response.data.admin);
      await cacheOfflineLogin(normalizedEmail, password, response.data.token, response.data.admin);
      router.push("/dashboard");
    } catch (onlineError) {
      try {
        const offlineSession = await verifyOfflineLogin(email, password);
        if (!offlineSession) throw onlineError;

        saveSession(offlineSession.token, offlineSession.admin);
        setMessage("Offline login successful. Local database mode is active.");
        window.setTimeout(() => router.push("/dashboard"), 400);
      } catch (offlineError) {
        setError(offlineError instanceof Error ? offlineError.message : "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>Admin Login</h1>
        <p>Online login is cached securely for future offline access.</p>

        {message ? <div className="notice success">{message}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <div className="form-group">
          <label>Email</label>
          <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>

        <button className="btn" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </main>
  );
}
