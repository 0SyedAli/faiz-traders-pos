"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AiOutlineProduct } from "react-icons/ai";
import { FaChevronDown, FaHome } from "react-icons/fa";
import { IoSettingsOutline } from "react-icons/io5";
import { MdOutlineInventory2 } from "react-icons/md";
import { TbFileInvoice } from "react-icons/tb";

type MenuGroup = { title: string; icon: React.ReactNode; items: { href: string; label: string }[] };

const groups: MenuGroup[] = [
  {
    title: "Sales & Invoicing", icon: <TbFileInvoice />, items: [
      { href: "/pos", label: "POS Sale" },
      { href: "/customers", label: "Customers" },
      { href: "/sales", label: "Invoices" },
      { href: "/sales-returns", label: "Credit Notes" }
    ]
  },
  {
    title: "Inventory & Purchases", icon: <MdOutlineInventory2 />, items: [
      { href: "/products", label: "Products" },
      { href: "/bulk-products", label: "Bulk Import" },
      { href: "/inventory", label: "Inventory" },
      { href: "/suppliers", label: "Vendors" },
      { href: "/purchases", label: "Purchases" }
    ]
  },
  {
    title: "Finance & Accounts", icon: <AiOutlineProduct />, items: [
      { href: "/expenses", label: "Expenses" },
      { href: "/reports", label: "Reports" }
    ]
  },
  {
    title: "System", icon: <IoSettingsOutline />, items: [
      { href: "/settings", label: "Settings" }
    ]
  }
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
const groupActive = (pathname: string, group: MenuGroup) => group.items.some((item) => isActive(pathname, item.href));

function pageLabel(pathname: string) {
  const root = `/${pathname.split("/").filter(Boolean)[0] || "dashboard"}`;
  const labels: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/pos": "POS Sale",
    "/customers": "Customers",
    "/sales": "Invoices",
    "/sales-returns": "Credit Notes",
    "/products": "Products",
    "/bulk-products": "Bulk Import",
    "/inventory": "Inventory",
    "/suppliers": "Vendors",
    "/purchases": "Purchases",
    "/expenses": "Expenses",
    "/reports": "Reports",
    "/settings": "Settings"
  };
  return labels[root] || "Dashboard";
}

export function DashboardLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const token = localStorage.getItem("my_store_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setCheckingAuth(false);
  }, [router]);

  useEffect(() => {
    const opened: Record<string, boolean> = {};
    groups.forEach((group) => {
      if (groupActive(pathname, group)) opened[group.title] = true;
    });
    setOpenGroups((prev) => ({ ...prev, ...opened }));
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (!target || target.tagName !== "INPUT") return;
      const placeholder = (target.getAttribute("placeholder") || "").toLowerCase();
      const isSearch = target.type === "search" || placeholder.includes("search") || placeholder.includes("sku") || placeholder.includes("barcode");
      if (!isSearch) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const scope = target.closest(".card") || target.closest(".content") || document;
        const buttons = Array.from(scope.querySelectorAll("button")) as HTMLButtonElement[];
        const button = buttons.find((btn) => ["search", "apply", "filter"].includes((btn.textContent || "").trim().toLowerCase()));
        if (button && !button.disabled) button.click();
      }, 450);
    };
    document.addEventListener("input", handler);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("input", handler);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem("my_store_token");
    localStorage.removeItem("my_store_admin");
    router.push("/login");
  };

  if (checkingAuth) {
    return <div className="auth-page"><div className="auth-card"><h1>Loading...</h1><p>Checking admin session.</p></div></div>;
  }

  return (
    <div className="kanakku-shell">
      {/* <aside className="side-rail">
        <Link className="rail-plus" href="/pos">+</Link>
        <span className="rail-dot" />
        <span className="rail-dot" />
        <button className="rail-logout" onClick={logout}>↪</button>
      </aside> */}

      <aside className={mobileOpen ? "k-sidebar mobile-visible" : "k-sidebar"}>
        <div className="k-logo-row">
          <Link href="/dashboard" className="k-logo"><span className="k-logo-mark">FT</span><strong>Faiz Traders</strong></Link>
          <button className="k-sidebar-close" onClick={() => setMobileOpen(false)}>×</button>
        </div>

        <nav className="k-nav">
          <Link className={isActive(pathname, "/dashboard") ? "k-home active" : "k-home"} href="/dashboard"><FaHome /> Home</Link>
          {groups.map((group) => {
            const opened = openGroups[group.title] ?? groupActive(pathname, group);
            return (
              <div className="k-group" key={group.title}>
                <button className="k-group-title" onClick={() => setOpenGroups((prev) => ({ ...prev, [group.title]: !opened }))}>
                  <span><i>{group.icon}</i>{group.title}</span><b className={opened ? "open" : ""}><FaChevronDown /></b>
                </button>
                {opened ? <div className="k-submenu">
                  {group.items.map((item) => <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? "active" : ""}>{item.label}</Link>)}
                </div> : null}
              </div>
            );
          })}
        </nav>
      </aside>

      {mobileOpen ? <button className="mobile-backdrop" onClick={() => setMobileOpen(false)} /> : null}

      <main className="k-main">
        <header className="k-topbar">
          <div className="k-breadcrumb">
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>☰</button>
            <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: "4px" }}><FaHome /> Home</Link><span>›</span><strong>{pageLabel(pathname)}</strong>
          </div>
          <div className="k-top-actions">
            {/* <div className="k-global-search"><input type="search" placeholder="Search" /><span>⌕</span></div> */}
            <Link className="k-new-btn" href="/pos">+ New Sale</Link>
            {/* <button className="k-icon-btn">●</button>
            <button className="k-icon-btn">☾</button>
            <button className="k-avatar" onClick={logout}>A</button> */}
          </div>
        </header>
        <section className="k-content">{children}</section>
      </main>
    </div>
  );
}
