"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { EditableCompanyName } from "@/components/layout/EditableCompanyName";

const SIDEBAR_COLLAPSED_KEY = "accounting-sidebar-collapsed";

const navItems = [
  { href: "/dashboard", label: "日結表", short: "日" },
  { href: "/reports", label: "月結摘要", short: "月" },
];

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

  const asideWidth = collapsed ? "md:w-[4.25rem]" : "md:w-60";

  const sidebar = (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ${asideWidth} w-60`}
    >
      <div
        className={`border-b border-slate-200 ${collapsed ? "px-2 py-4" : "px-4 py-5"}`}
      >
        <div
          className={`flex items-center gap-2 ${collapsed ? "flex-col" : "justify-between"}`}
        >
          {!collapsed ? (
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              會計管理系統
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              toggleSidebar();
              setMobileOpen(false);
            }}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            title={collapsed ? "展開側邊欄" : "收合側邊欄"}
            aria-expanded={!collapsed}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>
        <div className={collapsed ? "mt-3 flex justify-center" : "mt-2"}>
          {mounted ? (
            <EditableCompanyName
              initialName={orgName}
              organizationId={organizationId}
              collapsed={collapsed}
            />
          ) : (
            <p className="text-lg font-semibold">{orgName}</p>
          )}
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-emerald-50 text-emerald-900"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              } ${collapsed ? "px-2 text-center" : ""}`}
            >
              {collapsed ? item.short : item.label}
            </Link>
          );
        })}
      </nav>
      <form action={signOut} className="border-t border-slate-200 p-2">
        <button
          type="submit"
          className={`w-full rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 ${
            collapsed ? "px-2 text-center" : "text-left"
          }`}
          title="登出"
        >
          {collapsed ? "出" : "登出"}
        </button>
      </form>
    </aside>
  );

  return (
    <div className="flex min-h-full bg-slate-50 text-slate-900">
      <div className="hidden md:block">{sidebar}</div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="關閉選單"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full shadow-xl">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="min-h-11 rounded-md border border-slate-200 px-3 py-2 text-sm"
          >
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
          <form action={signOut}>
            <button
              type="submit"
              className="min-h-11 shrink-0 px-2 text-sm text-slate-600"
            >
              登出
            </button>
          </form>
        </header>

        <main className="flex-1 p-2 sm:p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
