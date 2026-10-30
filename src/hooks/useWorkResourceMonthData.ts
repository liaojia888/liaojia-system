"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  fetchWorkResourceMonth,
  saveWorkResourceMonth,
  type WorkResourceMonthPayload,
} from "@/app/actions/work-resources";
import {
  defaultWorkResourceRowsForMonth,
  mergeWorkResourceMonthByDate,
  monthHasWorkResourceData,
  sortWorkResourceRows,
  type WorkResourceRow,
} from "@/lib/work-resources";
import {
  loadLocalWorkResourceMonth,
  loadWorkResourceLastRemoteAppliedAt,
  markWorkResourceRemoteAppliedAt,
  saveLocalWorkResourceMonth,
} from "@/lib/work-resources-local-store";

export type WorkResourceSyncStatus =
  | "idle"
  | "local_saved"
  | "cloud_pending"
  | "synced"
  | "syncing"
  | "conflict"
  | "error"
  | "local_only";

function rowsForMonthKey(monthKey: string, year: number, month: number) {
  const local = loadLocalWorkResourceMonth(monthKey);
  return local?.length
    ? sortWorkResourceRows(local)
    : defaultWorkResourceRowsForMonth(year, month);
}

export function useWorkResourceMonthData({
  monthKey,
  year,
  month,
  organizationId,
}: {
  monthKey: string;
  year: number;
  month: number;
  organizationId: string | null;
}) {
  const [rows, setRowsState] = useState(() =>
    defaultWorkResourceRowsForMonth(year, month),
  );
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const writeLocalRows = useCallback(
    (next: WorkResourceRow[]) => {
      const sorted = sortWorkResourceRows(next);
      saveLocalWorkResourceMonth(monthKey, sorted);
      rowsRef.current = sorted;
      return sorted;
    },
    [monthKey],
  );

  const setRows: Dispatch<SetStateAction<WorkResourceRow[]>> = useCallback(
    (action) => {
      setRowsState((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        return writeLocalRows(next);
      });
    },
    [writeLocalRows],
  );

  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] =
    useState<WorkResourceSyncStatus>("local_saved");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [cloudConflict, setCloudConflict] =
    useState<WorkResourceMonthPayload | null>(null);
  const remoteUpdatedAtRef = useRef<string | null>(null);
  const cloudDirtyRef = useRef(false);
  const [cloudDirty, setCloudDirty] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const skipCloudDirtyOnceRef = useRef(true);

  function markCloudDirty() {
    if (!cloudDirtyRef.current) {
      cloudDirtyRef.current = true;
      setCloudDirty(true);
    }
    setSyncStatus((s) =>
      s === "conflict" || s === "syncing" ? s : "cloud_pending",
    );
  }

  function markCloudClean() {
    cloudDirtyRef.current = false;
    setCloudDirty(false);
  }

  const applyRemotePayload = useCallback(
    (
      local: WorkResourceRow[],
      remote: WorkResourceMonthPayload | null,
    ): WorkResourceRow[] => {
      if (!remote?.rows?.length) {
        remoteUpdatedAtRef.current = null;
        return local;
      }
      remoteUpdatedAtRef.current = remote.updatedAt;
      const lastApplied = loadWorkResourceLastRemoteAppliedAt(monthKey);
      const remoteAhead =
        !lastApplied ||
        new Date(remote.updatedAt) > new Date(lastApplied);

      if (!remoteAhead) return local;

      const merged = mergeWorkResourceMonthByDate(local, remote.rows);
      markWorkResourceRemoteAppliedAt(monthKey, remote.updatedAt);
      return merged;
    },
    [monthKey],
  );

  const syncMonthFromSupabase = useCallback(async () => {
    if (!organizationId) return;
    const result = await fetchWorkResourceMonth(monthKey);
    if (!result.ok) {
      setSyncStatus("error");
      setSyncMessage(result.error);
      return;
    }
    if (cloudDirtyRef.current) return;

    setRowsState((prev) => {
      const next = applyRemotePayload(prev, result.data);
      if (next !== prev) writeLocalRows(next);
      return next;
    });
    if (result.data) {
      markCloudClean();
      setSyncStatus("synced");
    }
  }, [applyRemotePayload, monthKey, organizationId, writeLocalRows]);

  const pullCloudMonth = useCallback(async () => {
    if (!organizationId) return;
    setSyncStatus("syncing");
    setSyncMessage(null);
    const result = await fetchWorkResourceMonth(monthKey);
    if (!result.ok) {
      setSyncStatus("error");
      setSyncMessage(result.error);
      return;
    }
    const template = defaultWorkResourceRowsForMonth(year, month);
    const local = rowsRef.current;
    const base = local.length ? local : template;
    const next = result.data?.rows?.length
      ? mergeWorkResourceMonthByDate(base, result.data.rows)
      : base;
    if (result.data) {
      remoteUpdatedAtRef.current = result.data.updatedAt;
      markWorkResourceRemoteAppliedAt(monthKey, result.data.updatedAt);
    }
    setRows(next);
    markCloudClean();
    setCloudConflict(null);
    setSyncStatus(result.data ? "synced" : "local_saved");
  }, [month, monthKey, organizationId, setRows, year]);

  useEffect(() => {
    skipCloudDirtyOnceRef.current = true;
    cloudDirtyRef.current = false;
    setCloudDirty(false);
    setCloudConflict(null);
    setSyncMessage(null);
    remoteUpdatedAtRef.current = null;

    const initial = rowsForMonthKey(monthKey, year, month);
    rowsRef.current = initial;
    setRowsState(initial);
    setReady(false);

    let cancelled = false;

    async function boot() {
      if (!organizationId) {
        setReady(true);
        setSyncStatus("local_only");
        return;
      }
      const result = await fetchWorkResourceMonth(monthKey);
      if (cancelled) return;
      if (!result.ok) {
        setSyncStatus("error");
        setSyncMessage(result.error);
        setReady(true);
        return;
      }

      const local = rowsForMonthKey(monthKey, year, month);
      const hasLocal = monthHasWorkResourceData(local);
      let next = local;
      if (result.data?.rows?.length) {
        if (!hasLocal) {
          next = mergeWorkResourceMonthByDate(
            defaultWorkResourceRowsForMonth(year, month),
            result.data.rows,
          );
        } else {
          next = applyRemotePayload(local, result.data);
        }
        remoteUpdatedAtRef.current = result.data.updatedAt;
      }
      writeLocalRows(next);
      setRowsState(next);
      setSyncStatus(hasLocal ? "local_saved" : result.data ? "synced" : "local_saved");
      setReady(true);
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [
    applyRemotePayload,
    month,
    monthKey,
    organizationId,
    writeLocalRows,
    year,
  ]);

  useEffect(() => {
    if (!organizationId) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (cloudDirtyRef.current) return;
      void syncMonthFromSupabase();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [organizationId, syncMonthFromSupabase]);

  useEffect(() => {
    if (!ready) return;
    if (!organizationId) {
      setSyncStatus("local_only");
      return;
    }
    if (skipCloudDirtyOnceRef.current) {
      skipCloudDirtyOnceRef.current = false;
      return;
    }
    markCloudDirty();
  }, [organizationId, ready, rows]);

  const saveToCloud = useCallback(async (): Promise<
    { ok: true } | { ok: false; error: string }
  > => {
    if (!organizationId) {
      return { ok: false, error: "尚未建立公司，無法寫入 Supabase。" };
    }
    setIsSavingCloud(true);
    setSyncStatus("syncing");
    setSyncMessage(null);
    const current = sortWorkResourceRows(rowsRef.current);
    saveLocalWorkResourceMonth(monthKey, current);
    try {
      const result = await saveWorkResourceMonth(
        monthKey,
        current,
        remoteUpdatedAtRef.current,
      );
      if (result.ok) {
        remoteUpdatedAtRef.current = result.updatedAt;
        markWorkResourceRemoteAppliedAt(monthKey, result.updatedAt);
        markCloudClean();
        setCloudConflict(null);
        setSyncStatus("synced");
        return { ok: true };
      }
      if (result.conflict) {
        setCloudConflict(result.conflict);
        setSyncStatus("conflict");
        setSyncMessage(result.error);
      } else {
        setSyncStatus("error");
        setSyncMessage(result.error);
      }
      return { ok: false, error: result.error };
    } finally {
      setIsSavingCloud(false);
    }
  }, [monthKey, organizationId]);

  const applyCloudVersion = useCallback(() => {
    if (!cloudConflict) return;
    const template = rowsRef.current.length
      ? rowsRef.current
      : defaultWorkResourceRowsForMonth(year, month);
    const next = mergeWorkResourceMonthByDate(
      template,
      cloudConflict.rows,
    );
    remoteUpdatedAtRef.current = cloudConflict.updatedAt;
    setRows(next);
    setCloudConflict(null);
    markCloudClean();
    setSyncStatus("synced");
    setSyncMessage(null);
  }, [cloudConflict, month, setRows, year]);

  const dismissCloudConflict = useCallback(() => {
    setCloudConflict(null);
    setSyncMessage(null);
    setSyncStatus(cloudDirtyRef.current ? "cloud_pending" : "local_saved");
  }, []);

  const persistBeforeShare = useCallback(async (): Promise<
    { ok: true } | { ok: false; error: string }
  > => {
    const current = sortWorkResourceRows(rowsRef.current);
    saveLocalWorkResourceMonth(monthKey, current);
    return { ok: true };
  }, [monthKey]);

  return {
    rows,
    setRows,
    ready,
    syncStatus,
    syncMessage,
    cloudConflict,
    cloudDirty,
    isSavingCloud,
    pullCloudMonth,
    saveToCloud,
    applyCloudVersion,
    dismissCloudConflict,
    persistBeforeShare,
  };
}
