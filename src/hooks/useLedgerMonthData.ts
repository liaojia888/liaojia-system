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
  fetchLedgerMonth,
  saveLedgerMonth,
  type LedgerMonthPayload,
} from "@/app/actions/daily-ledger";
import {
  defaultRowsForMonth,
  sortRowsByDate,
  type DailyLedgerRow,
} from "@/lib/daily-ledger";
import {
  loadLocalClientSavedAt,
  loadLocalMonth,
  saveLocalMonth,
} from "@/lib/ledger-local-store";
import {
  applyRemoteMonthToLocalTemplate,
  mergeLocalMonthWithRemote,
  monthHasUserData,
} from "@/lib/ledger-row-merge";
import { subscribeLedgerSync } from "@/lib/ledger-sync-events";

export type LedgerSyncStatus =
  | "idle"
  | "local_saved"
  | "cloud_pending"
  | "synced"
  | "syncing"
  | "conflict"
  | "error"
  | "local_only";

function rowsForMonthKey(monthKey: string, year: number, month: number) {
  const local = loadLocalMonth(monthKey);
  return local?.length
    ? sortRowsByDate(local)
    : defaultRowsForMonth(year, month);
}

function mergedDiffersFromRemote(
  merged: DailyLedgerRow[],
  remote: DailyLedgerRow[],
  year: number,
  month: number,
): boolean {
  const baseline = mergeLocalMonthWithRemote(
    defaultRowsForMonth(year, month),
    remote,
  );
  return JSON.stringify(merged) !== JSON.stringify(baseline);
}

export function useLedgerMonthData({
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
  /** 首屏與 SSR 一致（空白月模板）；掛載後再讀 localStorage，避免 hydration 錯誤 */
  const [rows, setRowsState] = useState(() =>
    defaultRowsForMonth(year, month),
  );
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const writeLocalRows = useCallback(
    (next: DailyLedgerRow[]) => {
      const sorted = sortRowsByDate(next);
      saveLocalMonth(monthKey, sorted);
      rowsRef.current = sorted;
      return sorted;
    },
    [monthKey],
  );

  /** 任一欄位（含轉數快／銀行／支出）變更後立刻寫入 localStorage */
  const setRows: Dispatch<SetStateAction<DailyLedgerRow[]>> = useCallback(
    (action) => {
      setRowsState((prev) => {
        const next =
          typeof action === "function" ? action(prev) : action;
        return writeLocalRows(next);
      });
    },
    [writeLocalRows],
  );
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<LedgerSyncStatus>("local_saved");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [cloudConflict, setCloudConflict] = useState<LedgerMonthPayload | null>(
    null,
  );
  const remoteUpdatedAtRef = useRef<string | null>(null);
  const saveGenerationRef = useRef(0);
  const shareLockRef = useRef(false);
  const cloudDirtyRef = useRef(false);
  const [cloudDirty, setCloudDirty] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const skipCloudDirtyOnceRef = useRef(true);
  const fetchGenerationRef = useRef(0);

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
      local: DailyLedgerRow[],
      remote: LedgerMonthPayload | null,
      options?: { forceRemote?: boolean },
    ): DailyLedgerRow[] => {
      if (!remote?.rows?.length) {
        remoteUpdatedAtRef.current = null;
        return local;
      }
      const remoteRows = sortRowsByDate(remote.rows);
      remoteUpdatedAtRef.current = remote.updatedAt;

      const localSavedAt = loadLocalClientSavedAt(monthKey);
      const remoteIsNewer =
        !localSavedAt ||
        new Date(remote.updatedAt) > new Date(localSavedAt);

      const useRemoteAsBase =
        options?.forceRemote ||
        (remoteIsNewer && !cloudDirtyRef.current);

      const merged = useRemoteAsBase
        ? applyRemoteMonthToLocalTemplate(local, remoteRows)
        : mergeLocalMonthWithRemote(local, remoteRows);

      if (useRemoteAsBase) {
        markCloudClean();
        setSyncStatus("synced");
        return merged;
      }

      const hadLocal = monthHasUserData(local);
      const differs = mergedDiffersFromRemote(
        merged,
        remoteRows,
        year,
        month,
      );

      if (hadLocal && differs) {
        markCloudDirty();
      } else {
        markCloudClean();
        setSyncStatus("synced");
      }

      return merged;
    },
    [monthKey, year, month],
  );

  const syncMonthFromSupabase = useCallback(async (): Promise<
    { ok: true } | { ok: false; error: string }
  > => {
    if (!organizationId) {
      return { ok: false, error: "尚未建立公司。" };
    }

    const generation = ++fetchGenerationRef.current;
    setSyncMessage(null);

    const local = rowsForMonthKey(monthKey, year, month);
    const result = await fetchLedgerMonth(monthKey);

    if (generation !== fetchGenerationRef.current) {
      return { ok: true };
    }

    if (!result.ok) {
      rowsRef.current = local;
      setRowsState(local);
      setSyncStatus("error");
      setSyncMessage(result.error);
      return { ok: false, error: result.error };
    }

    const merged = applyRemotePayload(local, result.data);
    const sorted = writeLocalRows(merged);
    rowsRef.current = sorted;
    setRowsState(sorted);
    skipCloudDirtyOnceRef.current = true;

    if (result.data?.rows?.length) {
      setSyncStatus((s) =>
        s === "cloud_pending" ? s : "synced",
      );
    } else if (monthHasUserData(sorted)) {
      setSyncStatus("local_saved");
    } else {
      setSyncStatus("local_saved");
    }

    return { ok: true };
  }, [
    applyRemotePayload,
    monthKey,
    month,
    organizationId,
    writeLocalRows,
    year,
  ]);

  const reloadFromLocalCache = useCallback(() => {
    if (shareLockRef.current || cloudDirtyRef.current) return;
    const local = loadLocalMonth(monthKey);
    if (!local?.length) {
      const blank = defaultRowsForMonth(year, month);
      rowsRef.current = blank;
      setRowsState(blank);
      return;
    }
    setRows((prev) =>
      mergeLocalMonthWithRemote(prev, sortRowsByDate(local)),
    );
  }, [monthKey, year, month, setRows]);

  const reloadMonth = useCallback(() => {
    void syncMonthFromSupabase();
  }, [syncMonthFromSupabase]);

  /** 以 Supabase 為準覆蓋本月（本機未存變更時） */
  const pullCloudMonth = useCallback(async (): Promise<
    { ok: true } | { ok: false; error: string }
  > => {
    if (!organizationId) {
      return { ok: false, error: "尚未建立公司。" };
    }
    if (cloudDirtyRef.current) {
      return {
        ok: false,
        error: "本機有尚未存至 Supabase 的修改，請先儲存或還原後再拉取。",
      };
    }

    const generation = ++fetchGenerationRef.current;
    setSyncStatus("syncing");
    setSyncMessage(null);

    const local = rowsForMonthKey(monthKey, year, month);
    const result = await fetchLedgerMonth(monthKey);

    if (generation !== fetchGenerationRef.current) {
      return { ok: true };
    }

    if (!result.ok) {
      setSyncStatus("error");
      setSyncMessage(result.error);
      return { ok: false, error: result.error };
    }

    if (!result.data?.rows?.length) {
      setSyncMessage("Supabase 尚無本月資料。");
      setSyncStatus("local_saved");
      return { ok: true };
    }

    const merged = applyRemotePayload(local, result.data, {
      forceRemote: true,
    });
    const sorted = writeLocalRows(merged);
    rowsRef.current = sorted;
    setRowsState(sorted);
    skipCloudDirtyOnceRef.current = true;
    setSyncStatus("synced");
    setSyncMessage("已以 Supabase 覆蓋本月本機資料。");
    return { ok: true };
  }, [
    applyRemotePayload,
    monthKey,
    month,
    organizationId,
    writeLocalRows,
    year,
  ]);

  /** 切換月份或登入後：讀本機並從 Supabase 合併 */
  useEffect(() => {
    let cancelled = false;
    fetchGenerationRef.current += 1;
    const generation = fetchGenerationRef.current;

    setReady(false);
    setCloudConflict(null);
    skipCloudDirtyOnceRef.current = true;

    async function load() {
      const local = rowsForMonthKey(monthKey, year, month);

      if (!organizationId) {
        if (cancelled || generation !== fetchGenerationRef.current) return;
        rowsRef.current = local;
        setRowsState(local);
        remoteUpdatedAtRef.current = null;
        markCloudClean();
        setSyncStatus("local_only");
        setSyncMessage(null);
        setReady(true);
        return;
      }

      setSyncStatus("syncing");
      const result = await fetchLedgerMonth(monthKey);

      if (cancelled || generation !== fetchGenerationRef.current) return;

      if (!result.ok) {
        rowsRef.current = local;
        setRowsState(local);
        setSyncStatus("error");
        setSyncMessage(result.error);
        setReady(true);
        return;
      }

      const merged = applyRemotePayload(local, result.data);
      const sorted = writeLocalRows(merged);
      rowsRef.current = sorted;
      setRowsState(sorted);
      setSyncMessage(null);
      setReady(true);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    applyRemotePayload,
    monthKey,
    month,
    organizationId,
    writeLocalRows,
    year,
  ]);

  useEffect(() => {
    if (!organizationId) {
      remoteUpdatedAtRef.current = null;
      setSyncStatus("local_only");
    }
  }, [organizationId]);

  useEffect(() => {
    return subscribeLedgerSync((msg) => {
      if (msg.monthKey !== monthKey && msg.monthKey !== "*") return;
      reloadFromLocalCache();
    });
  }, [monthKey, reloadFromLocalCache]);

  /** 回到分頁時若本機無未存變更，再拉一次 Supabase（多裝置同步） */
  useEffect(() => {
    if (!organizationId) return;

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (cloudDirtyRef.current || shareLockRef.current) return;
      void syncMonthFromSupabase();
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [organizationId, syncMonthFromSupabase]);

  /** 編輯後更新 Supabase 同步狀態（本機已在 setRows 當下寫入） */
  useEffect(() => {
    if (!ready || rows.length === 0) return;

    if (!organizationId) {
      setSyncStatus("local_only");
      return;
    }
    if (skipCloudDirtyOnceRef.current) {
      skipCloudDirtyOnceRef.current = false;
      setSyncStatus((s) =>
        s === "conflict" || s === "syncing" ? s : s === "synced" ? "synced" : "local_saved",
      );
      return;
    }
    markCloudDirty();
  }, [rows, monthKey, ready, organizationId]);

  const applyCloudVersion = useCallback(() => {
    if (!cloudConflict) return;
    const remoteRows = sortRowsByDate(cloudConflict.rows);
    const next = mergeLocalMonthWithRemote(rowsRef.current, remoteRows);
    remoteUpdatedAtRef.current = cloudConflict.updatedAt;
    setRows(next);
    setCloudConflict(null);
    markCloudClean();
    setSyncStatus("synced");
    setSyncMessage(null);
  }, [cloudConflict, setRows]);

  const dismissCloudConflict = useCallback(() => {
    setCloudConflict(null);
    setSyncMessage(null);
    setSyncStatus(cloudDirtyRef.current ? "cloud_pending" : "local_saved");
  }, []);

  /** 手動寫入 Supabase */
  const saveToCloud = useCallback(async (): Promise<
    { ok: true } | { ok: false; error: string }
  > => {
    if (!organizationId) {
      return { ok: false, error: "尚未建立公司，無法寫入 Supabase。" };
    }

    setIsSavingCloud(true);
    setSyncStatus("syncing");
    setSyncMessage(null);
    saveGenerationRef.current += 1;

    const current = sortRowsByDate(rowsRef.current);
    saveLocalMonth(monthKey, current);

    try {
      const result = await saveLedgerMonth(
        monthKey,
        current,
        remoteUpdatedAtRef.current,
      );

      if (result.ok) {
        remoteUpdatedAtRef.current = result.updatedAt;
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

  const persistBeforeShare = useCallback(async (): Promise<
    { ok: true } | { ok: false; error: string }
  > => {
    const current = sortRowsByDate(rowsRef.current);
    saveLocalMonth(monthKey, current);
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
    reloadMonth,
    pullCloudMonth,
    syncMonthFromSupabase,
    applyCloudVersion,
    dismissCloudConflict,
    saveToCloud,
    persistBeforeShare,
  };
}
