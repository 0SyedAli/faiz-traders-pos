"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pos", label: "POS Sale" },
  { href: "/sales", label: "Sales History" },
  { href: "/sales-returns", label: "Sales Returns" },
  { href: "/products", label: "Products" },
  { href: "/bulk-products", label: "Bulk Import" },
  { href: "/inventory", label: "Inventory" },
  { href: "/customers", label: "Customers / Plumbers" },
  { href: "/purchases", label: "Purchases" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/expenses", label: "Expenses" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" }
];

export function DashboardLayout({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("my_store_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setCheckingAuth(false);
  }, [router]);

  const logout = () => {
    localStorage.removeItem("my_store_token");
    localStorage.removeItem("my_store_admin");
    router.push("/login");
  };

  if (checkingAuth) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Loading...</h1>
          <p>Checking admin session.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h2>My Store</h2>
          <span>Sanitary POS + ERP</span>
        </div>

        <nav className="nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "active" : ""}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>{title}</h1>
          <button className="btn btn-light" onClick={logout}>
            Logout
          </button>
        </header>

        <section className="content">{children}</section>
      </main>
    </div>
  );
}
