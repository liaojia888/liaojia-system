"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  LEDGER_STORAGE_KEY,
  computeRows,
  computeTotals,
  defaultRowsForMonth,
  normalizeRow,
  sortRowsByDate,
} from "@/lib/daily-ledger";

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function loadMonthRows(key: string) {
  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<
      string,
      { rows: Record<string, unknown>[] }
    >;
    const rows = all[key]?.rows;
    if (!rows?.length) return null;
    return rows.map((r) => normalizeRow(r));
  } catch {
    return null;
  }
}

function money(n: number) {
  return n.toLocaleString("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  });
}

export function MonthlyLedgerReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState(() =>
    defaultRowsForMonth(now.getFullYear(), now.getMonth() + 1),
  );

  const key = monthKey(year, month);

  useEffect(() => {
    const stored = loadMonthRows(key);
    setRows(stored?.length ? sortRowsByDate(stored) : defaultRowsForMonth(year, month));
  }, [key, year, month]);

  const totals = useMemo(
    () => computeTotals(computeRows(sortRowsByDate(rows))),
    [rows],
  );

  const hasAnyData = useMemo(
    () =>
      rows.some(
        (r) =>
          r.fuel ||
          r.water ||
          r.urea ||
          r.fpsAmount ||
          r.bankDeposited ||
          r.bankPending ||
          r.cancelled ||
          r.expenses ||
          Object.keys(r.notes ?? {}).length > 0,
      ),
    [rows],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">月結摘要</h1>
          <p className="mt-1 text-sm text-slate-600">
            依「日結表」同一月份資料自動加總（本機儲存），方便核對無須重填。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const d = new Date(year, month - 2, 1);
              setYear(d.getFullYear());
              setMonth(d.getMonth() + 1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            上個月
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date(year, month, 1);
              setYear(d.getFullYear());
              setMonth(d.getMonth() + 1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            下個月
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            前往日結表編輯
          </Link>
        </div>
      </div>

      <p className="text-sm font-medium text-slate-800">
        {year} 年 {month} 月
      </p>

      {!hasAnyData ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          此月份日結表尚無輸入資料。請至{" "}
          <Link href="/dashboard" className="font-medium text-emerald-800 underline">
            日結表
          </Link>{" "}
          填寫後再回到此頁查看摘要。
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <ReportBlock title="收入明細">
            <Row label="油收入" value={money(totals.fuel)} />
            <Row label="水收入" value={money(totals.water)} />
            <Row label="尿素收入" value={money(totals.urea)} />
            <Row label="品項小計" value={money(totals.productSubtotal)} strong />
            <Row label="撤單（扣減）" value={money(totals.cancelled)} />
            <Row label="總收入" value={money(totals.totalRevenue)} strong accent />
          </ReportBlock>
          <ReportBlock title="收款與支出">
            <Row label="轉數快 · 公司" value={money(totals.fpsCompany)} />
            <Row label="轉數快 · 私人" value={money(totals.fpsPrivate)} />
            <Row label="轉數快 · Alipay" value={money(totals.fpsAlipay)} />
            <Row label="已入銀行（公司）" value={money(totals.bankDeposited)} />
            <Row label="待入銀行（公司）" value={money(totals.bankPending)} />
            <Row label="支出" value={money(totals.expenses)} />
            <Row
              label="期末尾數"
              value={money(totals.closingBalance)}
              strong
              accent
            />
          </ReportBlock>
        </div>
      )}
    </div>
  );
}

function ReportBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <dl className="mt-4 space-y-2">{children}</dl>
    </section>
  );
}

function Row({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-slate-600">{label}</dt>
      <dd
        className={`tabular-nums ${
          accent
            ? "font-semibold text-emerald-800"
            : strong
              ? "font-semibold text-slate-900"
              : "text-slate-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
