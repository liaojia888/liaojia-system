"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { EditableCompanyName } from "@/components/layout/EditableCompanyName";
import { LogoutButton } from "@/components/layout/LogoutButton";

const SIDEBAR_COLLAPSED_KEY = "accounting-sidebar-collapsed";

const navItems = [
  {
    href: "/dashboard",
    label: "日結表",
    short: "日",
    icon: (
      <svg
        className="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <path d="M4 6h16M4 12h16M4 18h8" strokeLinecap="round" />
        <rect x="15" y="15" width="5" height="5" rx="1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/reports",
    label: "月結摘要",
    short: "月",
    icon: (
      <svg
        className="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <path d="M4 19V5M4 19h16" strokeLinecap="round" />
        <path d="M8 17V11M12 17V7M16 17v-4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "系統設定",
    short: "設",
    icon: (
      <svg
        className="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

function SidebarToggle({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? "展開側邊欄" : "收合側邊欄"}
      aria-expanded={!collapsed}
      className="sidebar-toggle flex h-9 w-9 items-center justify-center rounded-full border transition"
    >
      <svg
        className={`h-4 w-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function AppShell({
  children,
  orgName,
  organizationId,
}: {
  children: React.ReactNode;
  orgName: string;
  organizationId: string | null;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const asideWidth = collapsed ? "md:w-[4.75rem]" : "md:w-[17rem]";

  const sidebar = (
    <aside
      className={`app-sidebar flex h-full shrink-0 flex-col transition-[width] duration-300 ease-out ${asideWidth} w-[17rem]`}
    >
      <div
        className={`relative overflow-hidden ${collapsed ? "px-2.5 py-5" : "px-4 py-6"}`}
      >
        <div
          className="sidebar-glow pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full blur-3xl"
          aria-hidden
        />
        <div
          className={`relative flex items-center gap-2 ${collapsed ? "flex-col" : "justify-between"}`}
        >
          {!collapsed ? (
            <div>
              <p className="sidebar-brand text-[10px] font-semibold uppercase tracking-[0.2em] opacity-90">
                Liaojia
              </p>
              <p className="mt-0.5 text-sm font-medium text-white/90">會計工作台</p>
            </div>
          ) : (
            <span className="sidebar-brand text-xs font-bold tracking-tight">L</span>
          )}
          <SidebarToggle
            collapsed={collapsed}
            onClick={() => {
              toggleSidebar();
              setMobileOpen(false);
            }}
          />
        </div>
        <div className={collapsed ? "relative mt-4 flex justify-center" : "relative mt-5"}>
          {mounted ? (
            <EditableCompanyName
              initialName={orgName}
              organizationId={organizationId}
              collapsed={collapsed}
              variant="sidebar"
            />
          ) : (
            <p className="text-lg font-semibold text-white">{orgName}</p>
          )}
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5 px-2.5 pb-4">
        {!collapsed ? (
          <p className="sidebar-brand mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider opacity-50">
            功能
          </p>
        ) : null}
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`sidebar-nav-link group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                active ? "sidebar-nav-link-active" : ""
              } ${collapsed ? "justify-center px-2" : ""}`}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              {!collapsed ? <span>{item.label}</span> : null}
              {active && !collapsed ? (
                <span className="sidebar-nav-dot ml-auto h-1.5 w-1.5 rounded-full" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-divider border-t p-2.5">
        <LogoutButton
          label={collapsed ? "出" : "登出"}
          className={`sidebar-logout w-full rounded-xl border px-3 py-2.5 text-sm font-medium transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-100 ${
            collapsed ? "text-center" : "text-left"
          }`}
        />
      </div>
    </aside>
  );

  return (
    <div className="app-shell flex min-h-full text-slate-900">
      <div className="hidden md:block">{sidebar}</div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            aria-label="關閉選單"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full shadow-2xl">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-white/80 px-3 py-2.5 backdrop-blur-md md:hidden pt-[max(0.625rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
            選單
          </button>
          {mounted ? (
            <EditableCompanyName
              initialName={orgName}
              organizationId={organizationId}
              compact
            />
          ) : (
            <span className="truncate font-semibold">{orgName}</span>
          )}
          <LogoutButton className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-medium text-slate-600 hover:text-slate-900" />
        </header>

        <main className="flex-1 p-2 sm:p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
