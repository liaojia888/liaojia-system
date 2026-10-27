import {
  isExpenseEntryCounted,
  isFpsEntryCounted,
  rowHasAnyNotes,
  sortRowsByDate,
  type DailyLedgerRow,
} from "@/lib/daily-ledger";

/** 粗略衡量列上資料多寡，用於避免被較空的版本覆蓋 */
export function ledgerRowRichness(row: DailyLedgerRow): number {
  let score = 0;
  if (row.fuel > 0) score += 1;
  if (row.water > 0) score += 1;
  if (row.urea > 0) score += 1;
  if (row.bankDeposited > 0) score += 2;
  if (row.bankPending > 0) score += 2;
  if (row.cancelled > 0) score += 2;
  score += row.fpsEntries.filter(isFpsEntryCounted).length * 3;
  score += row.expenseEntries.filter(isExpenseEntryCounted).length * 3;
  if (rowHasAnyNotes(row)) score += 1;
  return score;
}

export function pickRicherRow(
  a: DailyLedgerRow,
  b: DailyLedgerRow,
): DailyLedgerRow {
  return ledgerRowRichness(a) >= ledgerRowRichness(b) ? a : b;
}

/** 同日期以資料較完整的一列為準，保留 primary 的列 id */
export function mergeMonthRowsPreferRicher(
  primary: DailyLedgerRow[],
  secondary: DailyLedgerRow[],
): DailyLedgerRow[] {
  const secByDate = new Map(secondary.map((r) => [r.date, r]));
  return sortRowsByDate(
    primary.map((row) => {
      const other = secByDate.get(row.date);
      if (!other) return row;
      const richer = pickRicherRow(row, other);
      return richer === row ? row : { ...richer, id: row.id };
    }),
  );
}

export function monthHasUserData(rows: DailyLedgerRow[]): boolean {
  return rows.some((r) => ledgerRowRichness(r) > 0);
}

/** 合併本機月列與 Supabase 月列（保留本機列 id） */
export function mergeLocalMonthWithRemote(
  local: DailyLedgerRow[],
  remote: DailyLedgerRow[],
): DailyLedgerRow[] {
  return mergeMonthRowsPreferRicher(local, remote);
}

/** Supabase 較新時：以雲端列覆蓋對應日期（保留本機列 id），避免刪除後被舊本機「較完整」資料蓋回 */
export function applyRemoteMonthToLocalTemplate(
  local: DailyLedgerRow[],
  remote: DailyLedgerRow[],
): DailyLedgerRow[] {
  const remoteByDate = new Map(remote.map((r) => [r.date, r]));
  return sortRowsByDate(
    local.map((row) => {
      const rem = remoteByDate.get(row.date);
      if (!rem) return row;
      return { ...rem, id: row.id };
    }),
  );
}
