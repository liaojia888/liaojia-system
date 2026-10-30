import {
  computeRows,
  computeTotals,
  rowHasAnyNotes,
  sortRowsByDate,
  totalExpenseOutflow,
  totalFpsOutflow,
  type DailyLedgerRow,
  type DailyLedgerTotals,
} from "@/lib/daily-ledger";

export function monthBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function filterRowsByDateRange(
  rows: DailyLedgerRow[],
  startDate: string,
  endDate: string,
): DailyLedgerRow[] {
  return rows.filter((r) => r.date >= startDate && r.date <= endDate);
}

export function summarizeRows(rows: DailyLedgerRow[]): {
  totals: DailyLedgerTotals;
  hasAnyData: boolean;
} {
  const sorted = sortRowsByDate(rows);
  const computed = computeRows(sorted);
  const totals = computeTotals(computed);
  const hasAnyData = rows.some(
    (r) =>
      r.fuel ||
      r.water ||
      r.urea ||
      totalFpsOutflow(r.fpsEntries) > 0 ||
      r.bankDeposited ||
      r.bankPending ||
      r.cancelled ||
      totalExpenseOutflow(r.expenseEntries) > 0 ||
      rowHasAnyNotes(r),
  );
  return { totals, hasAnyData };
}

export type DailyTrendPoint = {
  date: string;
  label: string;
  totalRevenue: number;
  /** 年度各月圖：該月是否有日結資料 */
  hasData?: boolean;
};

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatReportRangeLabel(
  rangeStart: string,
  rangeEnd: string,
  bounds: { start: string; end: string },
): string | null {
  if (rangeStart === bounds.start && rangeEnd === bounds.end) return null;
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("zh-TW", {
      month: "numeric",
      day: "numeric",
    });
  return `${fmt(rangeStart)}–${fmt(rangeEnd)}`;
}

export function buildDailyRevenueTrend(
  rows: DailyLedgerRow[],
  range: { start: string; end: string },
): DailyTrendPoint[] {
  const computed = computeRows(sortRowsByDate(rows));
  const byDate = new Map(computed.map((r) => [r.date, r]));
  const points: DailyTrendPoint[] = [];
  const cursor = new Date(`${range.start}T12:00:00`);
  const end = new Date(`${range.end}T12:00:00`);
  while (cursor <= end) {
    const iso = isoDateLocal(cursor);
    const row = byDate.get(iso);
    points.push({
      date: iso,
      label: iso.slice(8),
      totalRevenue: row?.totalRevenue ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

export function buildYearMonthlyTrend(
  summaries: YearMonthSummary[],
): DailyTrendPoint[] {
  return summaries.map((s) => ({
    date: s.monthKey,
    label: `${s.month}月`,
    totalRevenue: s.hasData ? s.totals.totalRevenue : 0,
    hasData: s.hasData,
  }));
}

export function revenueChangePercent(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) {
    return current === 0 ? null : null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatChangePercent(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export type YearMonthSummary = {
  monthKey: string;
  month: number;
  totals: DailyLedgerTotals;
  hasData: boolean;
};

export function summarizeYearFromMonths(
  year: number,
  months: Record<string, DailyLedgerRow[]>,
): YearMonthSummary[] {
  const out: YearMonthSummary[] = [];
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, "0")}`;
    const rows = months[monthKey] ?? [];
    const { totals, hasAnyData } = summarizeRows(rows);
    out.push({
      monthKey,
      month: m,
      totals,
      hasData: hasAnyData,
    });
  }
  return out;
}

export function aggregateYearTotals(summaries: YearMonthSummary[]): DailyLedgerTotals {
  const base = summaries.reduce(
    (acc, s) => ({
      fuel: acc.fuel + s.totals.fuel,
      water: acc.water + s.totals.water,
      urea: acc.urea + s.totals.urea,
      productSubtotal: acc.productSubtotal + s.totals.productSubtotal,
      totalRevenue: acc.totalRevenue + s.totals.totalRevenue,
      fpsCompany: acc.fpsCompany + s.totals.fpsCompany,
      fpsPrivate: acc.fpsPrivate + s.totals.fpsPrivate,
      fpsAlipay: acc.fpsAlipay + s.totals.fpsAlipay,
      bankDeposited: acc.bankDeposited + s.totals.bankDeposited,
      bankPending: acc.bankPending + s.totals.bankPending,
      cancelled: acc.cancelled + s.totals.cancelled,
      expenses: acc.expenses + s.totals.expenses,
      closingBalance: 0,
    }),
    {
      fuel: 0,
      water: 0,
      urea: 0,
      productSubtotal: 0,
      totalRevenue: 0,
      fpsCompany: 0,
      fpsPrivate: 0,
      fpsAlipay: 0,
      bankDeposited: 0,
      bankPending: 0,
      cancelled: 0,
      expenses: 0,
      closingBalance: 0,
    },
  );
  for (let i = summaries.length - 1; i >= 0; i--) {
    if (summaries[i].hasData) {
      base.closingBalance = summaries[i].totals.closingBalance;
      break;
    }
  }
  return base;
}
