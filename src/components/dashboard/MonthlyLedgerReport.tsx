"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchLedgerMonth } from "@/app/actions/daily-ledger";
import {
  LEDGER_NOTE_LABELS,
  computeRows,
  sortRowsByDate,
  type DailyLedgerRow,
  type LedgerNoteKey,
} from "@/lib/daily-ledger";
import { loadLocalMonth } from "@/lib/ledger-local-store";
import { useLedgerMonthData } from "@/hooks/useLedgerMonthData";
import {
  buildDailyRevenueTrend,
  filterRowsByDateRange,
  formatChangePercent,
  formatReportRangeLabel,
  monthBounds,
  revenueChangePercent,
  summarizeRows,
} from "@/lib/ledger-analytics";
import { LedgerTrendChart } from "@/components/dashboard/LedgerTrendChart";
import { ReportPageSkeleton } from "@/components/dashboard/ReportPageSkeleton";
import { YearLedgerReportSection } from "@/components/dashboard/YearLedgerReportSection";
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

const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 5 + i);

function shiftCalendarMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function ledgerFocusHref(isoDate: string) {
  const y = isoDate.slice(0, 4);
  const m = Number.parseInt(isoDate.slice(5, 7), 10);
  return `/dashboard?year=${y}&month=${m}&focus=${encodeURIComponent(isoDate)}`;
}

function resourcesMonthHref(year: number, month: number) {
  return `/resources?year=${year}&month=${month}`;
}

function reportSyncLabel(syncStatus: string): string | null {
  if (syncStatus === "syncing") return "寫入 Supabase…";
  if (syncStatus === "cloud_pending") return "本機有變更 · 日結表可「儲存至 Supabase」";
  if (syncStatus === "local_only") return "僅本機（未連公司）";
  if (syncStatus === "conflict") return "雲端版本衝突 · 請至日結表處理";
  if (syncStatus === "error") return "雲端同步失敗";
  return null;
}

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
  const [yearLoadingCloud, setYearLoadingCloud] = useState(false);
  const [prevMonthRows, setPrevMonthRows] = useState<DailyLedgerRow[]>([]);
  const bounds = monthBounds(year, month);
  const [rangeStart, setRangeStart] = useState(bounds.start);
  const [rangeEnd, setRangeEnd] = useState(bounds.end);

  useEffect(() => {
    const b = monthBounds(year, month);
    setRangeStart(b.start);
    setRangeEnd(b.end);
  }, [year, month]);

  useEffect(() => {
    if (view !== "year") setYearLoadingCloud(false);
  }, [view]);

  const key = monthKey(year, month);

  const { rows, ready, syncStatus, persistBeforeShare } = useLedgerMonthData({
    monthKey: key,
    year,
    month,
    organizationId,
  });

  const prevMonth = useMemo(() => shiftCalendarMonth(year, month, -1), [year, month]);

  useEffect(() => {
    let cancelled = false;
    const pk = monthKey(prevMonth.year, prevMonth.month);
    const local = loadLocalMonth(pk) ?? [];
    setPrevMonthRows(local);
    if (!organizationId) return () => {
      cancelled = true;
    };
    void fetchLedgerMonth(pk).then((remote) => {
      if (cancelled || !remote.ok || !remote.data?.rows.length) return;
      setPrevMonthRows(remote.data.rows);
    });
    return () => {
      cancelled = true;
    };
  }, [prevMonth.year, prevMonth.month, organizationId]);

  const filteredRows = useMemo(
    () => filterRowsByDateRange(sortRowsByDate(rows), rangeStart, rangeEnd),
    [rows, rangeStart, rangeEnd],
  );

  const { totals, hasAnyData } = useMemo(
    () => summarizeRows(filteredRows),
    [filteredRows],
  );

  const rangeLabel = useMemo(
    () => formatReportRangeLabel(rangeStart, rangeEnd, bounds),
    [rangeStart, rangeEnd, bounds],
  );

  const isFullMonthRange =
    rangeStart === bounds.start && rangeEnd === bounds.end;

  const prevMonthTotals = useMemo(
    () => summarizeRows(prevMonthRows).totals,
    [prevMonthRows],
  );

  const revenueMomPct = useMemo(
    () =>
      isFullMonthRange
        ? revenueChangePercent(totals.totalRevenue, prevMonthTotals.totalRevenue)
        : null,
    [isFullMonthRange, totals.totalRevenue, prevMonthTotals.totalRevenue],
  );

  const trendPoints = useMemo(
    () =>
      buildDailyRevenueTrend(filteredRows, {
        start: rangeStart,
        end: rangeEnd,
      }),
    [filteredRows, rangeStart, rangeEnd],
  );

  const noteSections = useMemo(() => {
    const q = noteQuery.trim().toLowerCase();
    const sorted = sortRowsByDate(filteredRows);
    const sections: {
      rowId: string;
      dateLabel: string;
      focusDate: string;
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

      sections.push({
        rowId: row.id,
        dateLabel,
        focusDate: row.date,
        items,
      });
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
        window.alert(weChatShareSuccessMessage(result.mode));
      }
    })();
  }

  const syncHint =
    view === "year" && yearLoadingCloud
      ? "載入年度 Supabase 資料…"
      : view === "month"
        ? reportSyncLabel(syncStatus)
        : null;

  return (
    <div className="ledger-report-print ledger-workspace flex min-h-0 flex-1 flex-col">
      <header className="ledger-hero rounded-b-2xl px-3 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="ledger-hero-kicker text-[10px] font-bold uppercase tracking-[0.25em] sm:text-xs">
              {view === "month" ? "Monthly Report" : "Annual Report"}
            </p>
            <div className="ledger-no-print mt-2 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm">
                <span className="sr-only">年份</span>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 bg-white/80 px-2 py-1.5 text-sm font-medium"
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y} 年
                    </option>
                  ))}
                </select>
              </label>
              {view === "month" ? (
                <label className="flex items-center gap-1.5 text-sm">
                  <span className="sr-only">月份</span>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 bg-white/80 px-2 py-1.5 text-sm font-medium"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m} 月
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {year} 年{view === "month" ? ` ${month} 月` : " 度"}
              {view === "month" && rangeLabel ? (
                <span className="ml-2 text-lg font-medium text-slate-600">
                  （{rangeLabel}）
                </span>
              ) : null}
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

        {view === "month" && ready && hasAnyData ? (
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryStat
              label="淨收入（扣撤單）"
              value={money(totals.totalRevenue)}
              accent
              hint={
                isFullMonthRange
                  ? `較 ${prevMonth.month} 月 ${formatChangePercent(revenueMomPct)}`
                  : undefined
              }
            />
            <SummaryStat label="總支出" value={money(totals.expenses)} />
            <SummaryStat label="待入銀行" value={money(totals.bankPending)} />
            <SummaryStat label="期末尾數" value={money(totals.closingBalance)} accent />
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
            year={year}
            month={month}
            onPrint={() => window.print()}
            onExportCsv={exportMonthCsv}
            onWhatsApp={shareWhatsAppMonth}
            onWeChat={shareWeChatMonth}
          />
        ) : (
          <YearLedgerReportSection
            year={year}
            organizationId={organizationId}
            loadingCloudHint={setYearLoadingCloud}
            onPickMonth={(m) => {
              setView("month");
              setMonth(m);
            }}
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
  year,
  month,
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
    focusDate: string;
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
  year: number;
  month: number;
  onPrint: () => void;
  onExportCsv: () => void;
  onWhatsApp: () => void;
  onWeChat: () => void;
}) {
  const router = useRouter();

  if (!ready) {
    return <ReportPageSkeleton />;
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
        <details className="ledger-no-print w-full sm:w-auto">
          <summary className="ledger-touch-btn ledger-btn-ghost cursor-pointer list-none rounded-full px-4 py-2 text-sm font-medium shadow-sm [&::-webkit-details-marker]:hidden">
            分享與匯出
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <ActionBtn onClick={onExportCsv}>匯出 CSV</ActionBtn>
            <ActionBtn onClick={onWhatsApp}>WhatsApp</ActionBtn>
            <ActionBtn onClick={onWeChat}>微信</ActionBtn>
            <ActionBtn onClick={onPrint}>列印</ActionBtn>
          </div>
        </details>
        <Link
          href={resourcesMonthHref(year, month)}
          className="ledger-no-print text-sm font-medium text-[var(--theme-accent-strong)]"
        >
          同月工作資源進出表 →
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ReportBlock title="收入明細">
          <Row label="油收入" value={money(totals.fuel)} />
          <Row label="水收入" value={money(totals.water)} />
          <Row label="尿素收入" value={money(totals.urea)} />
          <Row label="總收入" value={money(totals.productSubtotal)} strong />
          <Row label="撤單（扣減）" value={money(totals.cancelled)} />
          <Row label="淨收入（扣撤單）" value={money(totals.totalRevenue)} strong accent />
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

      <LedgerTrendChart
        points={trendPoints}
        onPointClick={(p) => {
          if (p.date) router.push(ledgerFocusHref(p.date));
        }}
      />

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
                  {section.focusDate ? (
                    <Link
                      href={ledgerFocusHref(section.focusDate)}
                      className="report-theme-link"
                    >
                      {section.dateLabel}
                    </Link>
                  ) : (
                    section.dateLabel
                  )}
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
  hint,
}: {
  label: string;
  value: string;
  accent?: boolean;
  hint?: string;
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
      {hint ? (
        <p className="mt-1 text-[11px] font-medium text-slate-500">{hint}</p>
      ) : null}
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
