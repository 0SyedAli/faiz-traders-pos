"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pos", label: "POS Sale" },
  { href: "/products", label: "Products" },
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

  const logout = () => {
    localStorage.removeItem("my_store_token");
    localStorage.removeItem("my_store_admin");
    router.push("/login");
  };

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
              className={pathname === link.href ? "active" : ""}
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
