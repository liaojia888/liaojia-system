import {
  LEDGER_STORAGE_KEY,
  normalizeRow,
  type DailyLedgerRow,
} from "@/lib/daily-ledger";
import { broadcastLedgerMonthUpdated } from "@/lib/ledger-sync-events";

type StoredLedger = {
  monthKey: string;
  rows: DailyLedgerRow[];
  /** 本機最後寫入時間（ISO），用於避免被較舊的雲端覆蓋 */
  clientSavedAt?: string;
};

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadLocalMonth(monthKey: string): DailyLedgerRow[] | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, StoredLedger>;
    const rows = all[monthKey]?.rows;
    return rows?.map((r) => normalizeRow(r as Record<string, unknown>)) ?? null;
  } catch {
    return null;
  }
}

export function saveLocalMonth(monthKey: string, rows: DailyLedgerRow[]) {
  if (!canUseLocalStorage()) return;
  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, StoredLedger>) : {};
    all[monthKey] = {
      monthKey,
      rows,
      clientSavedAt: new Date().toISOString(),
    };
    localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore quota errors
  }
}

export function loadLocalClientSavedAt(monthKey: string): string | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, StoredLedger>;
    return all[monthKey]?.clientSavedAt ?? null;
  } catch {
    return null;
  }
}

export function loadAllLocalMonths(): Record<string, DailyLedgerRow[]> {
  if (!canUseLocalStorage()) return {};
  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) return {};
    const all = JSON.parse(raw) as Record<string, StoredLedger>;
    const out: Record<string, DailyLedgerRow[]> = {};
    for (const [key, entry] of Object.entries(all)) {
      if (entry?.rows?.length) {
        out[key] = entry.rows.map((r) =>
          normalizeRow(r as Record<string, unknown>),
        );
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function replaceAllLocalMonths(all: Record<string, DailyLedgerRow[]>) {
  if (!canUseLocalStorage()) return;
  try {
    const wrapped: Record<string, StoredLedger> = {};
    for (const [monthKey, rows] of Object.entries(all)) {
      wrapped[monthKey] = { monthKey, rows };
    }
    localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(wrapped));
    for (const monthKey of Object.keys(wrapped)) {
      broadcastLedgerMonthUpdated(monthKey);
    }
  } catch {
    // ignore
  }
}

/** 刪除瀏覽器內所有月份日結快取（不影響 Supabase）。回傳已清除的月份數。 */
export function clearAllLocalLedgerMonths(): number {
  if (!canUseLocalStorage()) return 0;
  const keys = Object.keys(loadAllLocalMonths());
  try {
    localStorage.removeItem(LEDGER_STORAGE_KEY);
  } catch {
    return 0;
  }
  for (const monthKey of keys) {
    broadcastLedgerMonthUpdated(monthKey);
  }
  return keys.length;
}
