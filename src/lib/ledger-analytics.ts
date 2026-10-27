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
};

export function buildDailyRevenueTrend(rows: DailyLedgerRow[]): DailyTrendPoint[] {
  const computed = computeRows(sortRowsByDate(rows));
  return computed
    .filter((r) => r.totalRevenue !== 0 || r.expenses !== 0)
    .map((r) => ({
      date: r.date,
      label: r.date.slice(8),
      totalRevenue: r.totalRevenue,
    }));
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
