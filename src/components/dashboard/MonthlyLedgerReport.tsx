"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  LEDGER_NOTE_LABELS,
  computeRows,
  sortRowsByDate,
  type LedgerNoteKey,
} from "@/lib/daily-ledger";
import { useLedgerMonthData } from "@/hooks/useLedgerMonthData";
import { useLedgerYearData } from "@/hooks/useLedgerYearData";
import {
  aggregateYearTotals,
  buildDailyRevenueTrend,
  filterRowsByDateRange,
  monthBounds,
  summarizeRows,
  summarizeYearFromMonths,
} from "@/lib/ledger-analytics";
import { LedgerTrendChart } from "@/components/dashboard/LedgerTrendChart";
import { buildMonthCsv, downloadTextFile } from "@/lib/ledger-export";
import { readLocalCompanyName } from "@/lib/company-display-name";
import {
  formatLedgerMonthForWhatsApp,
  openWhatsAppShare,
  shareViaWeChat,
  weChatShareSuccessMessage,
} from "@/lib/whatsapp-export";

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function money(n: number) {
  return n.toLocaleString("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  });
}

type ReportView = "month" | "year";

export function MonthlyLedgerReport({
  organizationId,
}: {
  organizationId: string | null;
}) {
  const now = new Date();
  const [view, setView] = useState<ReportView>("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [noteQuery, setNoteQuery] = useState("");
  const bounds = monthBounds(year, month);
  const [rangeStart, setRangeStart] = useState(bounds.start);
  const [rangeEnd, setRangeEnd] = useState(bounds.end);

  useEffect(() => {
    const b = monthBounds(year, month);
    setRangeStart(b.start);
    setRangeEnd(b.end);
  }, [year, month]);

  const key = monthKey(year, month);

  const { rows, ready, syncStatus, persistBeforeShare } = useLedgerMonthData({
    monthKey: key,
    year,
    month,
    organizationId,
  });

  const {
    months: yearMonths,
    ready: yearReady,
    loadingCloud: yearLoadingCloud,
  } = useLedgerYearData({ year, organizationId });

  const filteredRows = useMemo(
    () => filterRowsByDateRange(sortRowsByDate(rows), rangeStart, rangeEnd),
    [rows, rangeStart, rangeEnd],
  );

  const { totals, hasAnyData } = useMemo(
    () => summarizeRows(filteredRows),
    [filteredRows],
  );

  const trendPoints = useMemo(
    () => buildDailyRevenueTrend(filteredRows),
    [filteredRows],
  );

  const yearSummaries = useMemo(
    () => summarizeYearFromMonths(year, yearMonths),
    [year, yearMonths],
  );

  const yearTotals = useMemo(
    () => aggregateYearTotals(yearSummaries),
    [yearSummaries],
  );

  const yearHasData = yearSummaries.some((s) => s.hasData);

  const noteSections = useMemo(() => {
    const q = noteQuery.trim().toLowerCase();
    const sorted = sortRowsByDate(filteredRows);
    const sections: {
      rowId: string;
      dateLabel: string;
      items: { label: string; text: string }[];
    }[] = [];

    for (const row of sorted) {
      const notes = row.notes ?? {};
      const items = (Object.keys(notes) as LedgerNoteKey[])
        .filter((key) => notes[key]?.trim())
        .map((key) => ({
          label: LEDGER_NOTE_LABELS[key],
          text: notes[key]!.trim(),
        }))
        .filter(
          (item) =>
            !q ||
            item.label.toLowerCase().includes(q) ||
            item.text.toLowerCase().includes(q),
        );

      if (items.length === 0) continue;

      const dateLabel = row.date
        ? new Date(`${row.date}T12:00:00`).toLocaleDateString("zh-TW", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "short",
          })
        : "（未填日期）";

      sections.push({ rowId: row.id, dateLabel, items });
    }

    return sections;
  }, [filteredRows, noteQuery]);

  function exportMonthCsv() {
    const sorted = sortRowsByDate(filteredRows);
    const computed = computeRows(sorted);
    const csv = buildMonthCsv(`${key}_${rangeStart}_${rangeEnd}`, sorted, computed);
    downloadTextFile(`月結-${key}.csv`, csv, "text/csv;charset=utf-8");
  }

  function shareWhatsAppMonth() {
    void (async () => {
      const saved = await persistBeforeShare();
      if (!saved.ok) {
        window.alert(saved.error);
        return;
      }
      const sorted = sortRowsByDate(filteredRows);
      const computed = computeRows(sorted);
      const { totals: t } = summarizeRows(filteredRows);
      const result = openWhatsAppShare(
        formatLedgerMonthForWhatsApp(
          computed,
          t,
          year,
          month,
          readLocalCompanyName() ?? "公司",
        ),
      );
      if (!result.ok && result.error) {
        window.alert(result.error);
      }
    })();
  }

  function shareWeChatMonth() {
    void (async () => {
      const saved = await persistBeforeShare();
      if (!saved.ok) {
        window.alert(saved.error);
        return;
      }
      const sorted = sortRowsByDate(filteredRows);
      const computed = computeRows(sorted);
      const { totals: t } = summarizeRows(filteredRows);
      const result = await shareViaWeChat(
        formatLedgerMonthForWhatsApp(
          computed,
          t,
          year,
          month,
          readLocalCompanyName() ?? "公司",
        ),
      );
      if (!result.ok && result.error) {
        window.alert(result.error);
      } else {
        const msg = weChatShareSuccessMessage(result.mode);
        if (msg) window.alert(msg);
      }
    })();
  }

  const syncHint =
    syncStatus === "syncing"
      ? "寫入 Supabase…"
      : view === "year" && yearLoadingCloud
        ? "載入年度 Supabase 資料…"
        : null;

  return (
    <div className="ledger-report-print ledger-workspace flex min-h-0 flex-1 flex-col">
      <header className="ledger-hero rounded-b-2xl px-3 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="ledger-hero-kicker text-[10px] font-bold uppercase tracking-[0.25em] sm:text-xs">
              {view === "month" ? "Monthly Report" : "Annual Report"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {year} 年{view === "month" ? ` ${month} 月` : " 度"}
            </h1>
            <p className="mt-0.5 text-sm font-medium text-slate-600">
              {view === "month" ? "月結摘要" : "年度合計"}
            </p>
            <p className="mt-2 max-w-2xl text-xs text-slate-600 sm:text-sm">
              {view === "month"
                ? "與日結表同月資料加總；另開分頁編輯日結時，此頁會自動更新。"
                : "彙總 12 個月日結；期末尾數取該年最後一個有資料的月份。"}
            </p>
            {syncHint ? (
              <p className="mt-1 text-xs text-[var(--theme-accent-strong)]">
                {syncHint}
              </p>
            ) : null}
          </div>
          <div className="ledger-no-print flex flex-wrap gap-2">
            <div className="flex rounded-full border border-white/60 bg-white/70 p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setView("month")}
                className={`rounded-full px-3 py-2 text-sm font-medium sm:px-4 ${
                  view === "month" ? "ledger-btn-primary shadow-sm" : "text-slate-700"
                }`}
              >
                月度
              </button>
              <button
                type="button"
                onClick={() => setView("year")}
                className={`rounded-full px-3 py-2 text-sm font-medium sm:px-4 ${
                  view === "year" ? "ledger-btn-primary shadow-sm" : "text-slate-700"
                }`}
              >
                年度
              </button>
            </div>
            {view === "month" ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(year, month - 2, 1);
                    setYear(d.getFullYear());
                    setMonth(d.getMonth() + 1);
                  }}
                  className="ledger-touch-btn ledger-btn-ghost rounded-full px-4 py-2.5 text-sm font-medium shadow-sm sm:py-2"
                >
                  ← 上個月
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(year, month, 1);
                    setYear(d.getFullYear());
                    setMonth(d.getMonth() + 1);
                  }}
                  className="ledger-touch-btn ledger-btn-ghost rounded-full px-4 py-2.5 text-sm font-medium shadow-sm sm:py-2"
                >
                  下個月 →
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setYear((y) => y - 1)}
                  className="ledger-touch-btn ledger-btn-ghost rounded-full px-4 py-2.5 text-sm font-medium shadow-sm sm:py-2"
                >
                  ← 上一年
                </button>
                <button
                  type="button"
                  onClick={() => setYear((y) => y + 1)}
                  className="ledger-touch-btn ledger-btn-ghost rounded-full px-4 py-2.5 text-sm font-medium shadow-sm sm:py-2"
                >
                  下一年 →
                </button>
              </>
            )}
            <Link
              href="/dashboard"
              className="ledger-touch-btn ledger-btn-primary rounded-full px-4 py-2.5 text-sm font-medium shadow-sm sm:py-2"
            >
              前往日結表
            </Link>
          </div>
        </div>

        {view === "month" && hasAnyData ? (
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryStat label="總收入" value={money(totals.totalRevenue)} accent />
            <SummaryStat label="總支出" value={money(totals.expenses)} />
            <SummaryStat label="待入銀行" value={money(totals.bankPending)} />
            <SummaryStat label="期末尾數" value={money(totals.closingBalance)} accent />
          </div>
        ) : null}

        {view === "year" && yearHasData ? (
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryStat
              label="年度總收入"
              value={money(yearTotals.totalRevenue)}
              accent
            />
            <SummaryStat label="年度支出" value={money(yearTotals.expenses)} />
            <SummaryStat
              label="待入銀行（累計）"
              value={money(yearTotals.bankPending)}
            />
            <SummaryStat
              label="期末尾數"
              value={money(yearTotals.closingBalance)}
              accent
            />
          </div>
        ) : null}
      </header>

      <div className="space-y-6 p-3 sm:space-y-8 sm:p-4 lg:p-6">
        {view === "month" ? (
          <MonthReportBody
            ready={ready}
            hasAnyData={hasAnyData}
            totals={totals}
            noteSections={noteSections}
            noteQuery={noteQuery}
            setNoteQuery={setNoteQuery}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            setRangeStart={setRangeStart}
            setRangeEnd={setRangeEnd}
            bounds={bounds}
            trendPoints={trendPoints}
            onPrint={() => window.print()}
            onExportCsv={exportMonthCsv}
            onWhatsApp={shareWhatsAppMonth}
            onWeChat={shareWeChatMonth}
          />
        ) : (
          <YearReportBody
            ready={yearReady}
            year={year}
            summaries={yearSummaries}
            yearHasData={yearHasData}
            yearTotals={yearTotals}
            onPickMonth={(m) => {
              setView("month");
              setMonth(m);
            }}
            onPrint={() => window.print()}
          />
        )}
      </div>
    </div>
  );
}

function MonthReportBody({
  ready,
  hasAnyData,
  totals,
  noteSections,
  noteQuery,
  setNoteQuery,
  rangeStart,
  rangeEnd,
  setRangeStart,
  setRangeEnd,
  bounds,
  trendPoints,
  onPrint,
  onExportCsv,
  onWhatsApp,
  onWeChat,
}: {
  ready: boolean;
  hasAnyData: boolean;
  totals: ReturnType<typeof summarizeRows>["totals"];
  noteSections: {
    rowId: string;
    dateLabel: string;
    items: { label: string; text: string }[];
  }[];
  noteQuery: string;
  setNoteQuery: (v: string) => void;
  rangeStart: string;
  rangeEnd: string;
  setRangeStart: (v: string) => void;
  setRangeEnd: (v: string) => void;
  bounds: { start: string; end: string };
  trendPoints: ReturnType<typeof buildDailyRevenueTrend>;
  onPrint: () => void;
  onExportCsv: () => void;
  onWhatsApp: () => void;
  onWeChat: () => void;
}) {
  if (!ready) {
    return (
      <div className="report-page-card rounded-2xl p-6 text-sm text-slate-600">
        載入月結資料…
      </div>
    );
  }

  if (!hasAnyData) {
    return (
      <div className="report-page-card rounded-2xl p-6 text-sm text-slate-600">
        此月份日結表尚無輸入資料。請至{" "}
        <Link href="/dashboard" className="report-theme-link">
          日結表
        </Link>{" "}
        填寫後再回到此頁查看摘要。
      </div>
    );
  }

  return (
    <>
      <div className="ledger-no-print report-page-card flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4 sm:p-5">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">日期區間</span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={rangeStart}
              min={bounds.start}
              max={rangeEnd}
              onChange={(e) => setRangeStart(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
            <span className="text-slate-500">至</span>
            <input
              type="date"
              value={rangeEnd}
              min={rangeStart}
              max={bounds.end}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setRangeStart(bounds.start);
                setRangeEnd(bounds.end);
              }}
              className="text-sm font-medium text-[var(--theme-accent-strong)]"
            >
              整月
            </button>
          </div>
        </label>
        <label className="min-w-[12rem] flex-1 text-sm">
          <span className="mb-1 block font-medium text-slate-700">搜尋備註</span>
          <input
            type="search"
            value={noteQuery}
            onChange={(e) => setNoteQuery(e.target.value)}
            placeholder="關鍵字…"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <ActionBtn onClick={onExportCsv}>匯出 CSV</ActionBtn>
          <ActionBtn onClick={onWhatsApp}>WhatsApp</ActionBtn>
          <ActionBtn onClick={onWeChat}>微信</ActionBtn>
          <ActionBtn onClick={onPrint}>列印</ActionBtn>
        </div>
      </div>

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

      <LedgerTrendChart points={trendPoints} />

      {noteSections.length > 0 ? (
        <section className="report-notes-panel report-page-card rounded-2xl border p-4 sm:p-5">
          <h2 className="report-block-title text-base font-semibold">日結備註</h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            依日期排列；可用上方搜尋過濾。
          </p>
          <ul className="mt-4 space-y-4">
            {noteSections.map((section) => (
              <li
                key={section.rowId}
                className="report-note-item rounded-xl border p-3 sm:p-4"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {section.dateLabel}
                </p>
                <ul className="mt-2 space-y-2">
                  {section.items.map((item) => (
                    <li
                      key={`${section.rowId}-${item.label}`}
                      className="text-sm leading-relaxed text-slate-800"
                    >
                      <span className="report-note-label font-medium">
                        {item.label}
                      </span>
                      <span className="text-slate-600"> · </span>
                      <span className="whitespace-pre-wrap">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-slate-500">
          {noteQuery.trim()
            ? "沒有符合搜尋條件的備註。"
            : "此區間尚無備註。"}
        </p>
      )}
    </>
  );
}

function YearReportBody({
  ready,
  year,
  summaries,
  yearHasData,
  yearTotals,
  onPickMonth,
  onPrint,
}: {
  ready: boolean;
  year: number;
  summaries: ReturnType<typeof summarizeYearFromMonths>;
  yearHasData: boolean;
  yearTotals: ReturnType<typeof aggregateYearTotals>;
  onPickMonth: (month: number) => void;
  onPrint: () => void;
}) {
  if (!ready) {
    return (
      <div className="report-page-card rounded-2xl p-6 text-sm text-slate-600">
        載入年度資料…
      </div>
    );
  }

  if (!yearHasData) {
    return (
      <div className="report-page-card rounded-2xl p-6 text-sm text-slate-600">
        {year} 年尚無日結資料。請先在{" "}
        <Link href="/dashboard" className="report-theme-link">
          日結表
        </Link>{" "}
        輸入任一月資料。
      </div>
    );
  }

  const maxRevenue = Math.max(
    ...summaries.map((s) => s.totals.totalRevenue),
    1,
  );

  return (
    <>
      <div className="ledger-no-print flex justify-end">
        <ActionBtn onClick={onPrint}>列印年度摘要</ActionBtn>
      </div>
      <section className="report-page-card rounded-2xl p-4 sm:p-5">
        <h2 className="report-block-title text-base font-semibold">
          各月總收入趨勢
        </h2>
        <div className="mt-4 flex items-end gap-2 overflow-x-auto pb-2">
          {summaries.map((s) => {
            const h = Math.max(
              4,
              Math.round((s.totals.totalRevenue / maxRevenue) * 100),
            );
            return (
              <button
                key={s.monthKey}
                type="button"
                onClick={() => s.hasData && onPickMonth(s.month)}
                disabled={!s.hasData}
                className="flex min-w-[2.5rem] flex-col items-center gap-1 disabled:opacity-40"
                title={
                  s.hasData
                    ? `${s.month} 月：${money(s.totals.totalRevenue)}`
                    : `${s.month} 月無資料`
                }
              >
                <div
                  className="ledger-trend-bar w-7 rounded-t-md"
                  style={{ height: `${h}px` }}
                />
                <span className="text-xs font-medium">{s.month}月</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="report-page-card overflow-x-auto rounded-2xl p-4 sm:p-5">
        <h2 className="report-block-title text-base font-semibold">月份明細</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-600">
              <th className="pb-2 pr-4 font-medium">月份</th>
              <th className="pb-2 pr-4 text-right font-medium">總收入</th>
              <th className="pb-2 pr-4 text-right font-medium">支出</th>
              <th className="pb-2 text-right font-medium">期末尾數</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.monthKey} className="border-t border-slate-100">
                <td className="py-2 pr-4">
                  {s.hasData ? (
                    <button
                      type="button"
                      onClick={() => onPickMonth(s.month)}
                      className="report-theme-link font-medium"
                    >
                      {year} 年 {s.month} 月
                    </button>
                  ) : (
                    <span className="text-slate-400">
                      {year} 年 {s.month} 月
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {s.hasData ? money(s.totals.totalRevenue) : "—"}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {s.hasData ? money(s.totals.expenses) : "—"}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {s.hasData ? money(s.totals.closingBalance) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-300 font-semibold">
              <td className="py-3 pr-4">年度合計</td>
              <td className="py-3 pr-4 text-right tabular-nums">
                {money(yearTotals.totalRevenue)}
              </td>
              <td className="py-3 pr-4 text-right tabular-nums">
                {money(yearTotals.expenses)}
              </td>
              <td className="py-3 text-right tabular-nums">
                {money(yearTotals.closingBalance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>
    </>
  );
}

function ActionBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ledger-touch-btn ledger-btn-ghost rounded-full px-4 py-2 text-sm font-medium shadow-sm"
    >
      {children}
    </button>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 shadow-sm backdrop-blur-sm ${
        accent ? "ledger-stat-accent" : "border-white/60 bg-white/70"
      }`}
    >
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p
        data-report-stat={label}
        className={`ledger-stat-value mt-1 text-xl font-semibold tabular-nums ${
          accent ? "" : "text-slate-900"
        }`}
      >
        {value}
      </p>
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
    <section className="report-page-card rounded-2xl p-5 sm:p-6">
      <h2 className="report-block-title text-base font-semibold">{title}</h2>
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
            ? "report-row-accent font-semibold"
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
