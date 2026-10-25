import {
  LEDGER_STORAGE_KEY,
  normalizeRow,
  type DailyLedgerRow,
} from "@/lib/daily-ledger";
import { broadcastLedgerMonthUpdated } from "@/lib/ledger-sync-events";

type StoredLedger = {
  monthKey: string;
  rows: DailyLedgerRow[];
};

export function loadLocalMonth(monthKey: string): DailyLedgerRow[] | null {
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
  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, StoredLedger>) : {};
    all[monthKey] = { monthKey, rows };
    localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore quota errors
  }
}

export function loadAllLocalMonths(): Record<string, DailyLedgerRow[]> {
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
