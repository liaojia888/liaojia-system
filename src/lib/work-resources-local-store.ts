import {
  WORK_RESOURCE_STORAGE_KEY,
  normalizeWorkResourceRow,
  type WorkResourceRow,
} from "@/lib/work-resources";

type StoredMonth = {
  monthKey: string;
  rows: WorkResourceRow[];
  clientSavedAt?: string;
  lastRemoteAppliedAt?: string;
};

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadLocalWorkResourceMonth(
  monthKey: string,
): WorkResourceRow[] | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(WORK_RESOURCE_STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, StoredMonth>;
    const rows = all[monthKey]?.rows;
    return (
      rows?.map((r) =>
        normalizeWorkResourceRow(r as unknown as Record<string, unknown>),
      ) ?? null
    );
  } catch {
    return null;
  }
}

export function saveLocalWorkResourceMonth(
  monthKey: string,
  rows: WorkResourceRow[],
) {
  if (!canUseLocalStorage()) return;
  try {
    const raw = localStorage.getItem(WORK_RESOURCE_STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, StoredMonth>) : {};
    all[monthKey] = {
      monthKey,
      rows,
      clientSavedAt: new Date().toISOString(),
    };
    localStorage.setItem(WORK_RESOURCE_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

export function loadWorkResourceLastRemoteAppliedAt(
  monthKey: string,
): string | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(WORK_RESOURCE_STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, StoredMonth>;
    return all[monthKey]?.lastRemoteAppliedAt ?? null;
  } catch {
    return null;
  }
}

export function markWorkResourceRemoteAppliedAt(
  monthKey: string,
  remoteUpdatedAt: string,
) {
  if (!canUseLocalStorage()) return;
  try {
    const raw = localStorage.getItem(WORK_RESOURCE_STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, StoredMonth>) : {};
    const prev = all[monthKey];
    all[monthKey] = {
      monthKey,
      rows: prev?.rows ?? [],
      clientSavedAt: prev?.clientSavedAt,
      lastRemoteAppliedAt: remoteUpdatedAt,
    };
    localStorage.setItem(WORK_RESOURCE_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}
