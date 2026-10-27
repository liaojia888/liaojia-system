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
  saveLedgerMonth,
  type LedgerMonthPayload,
} from "@/app/actions/daily-ledger";
import {
  defaultRowsForMonth,
  sortRowsByDate,
  type DailyLedgerRow,
} from "@/lib/daily-ledger";
import { loadLocalMonth, saveLocalMonth } from "@/lib/ledger-local-store";
import { mergeMonthRowsPreferRicher } from "@/lib/ledger-row-merge";
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
      mergeMonthRowsPreferRicher(prev, sortRowsByDate(local)),
    );
  }, [monthKey, year, month]);

  const reloadMonth = useCallback(() => {
    const local = loadLocalMonth(monthKey);
    if (local?.length) {
      setRows((prev) =>
        mergeMonthRowsPreferRicher(prev, sortRowsByDate(local)),
      );
    }
    setSyncMessage(null);
  }, [monthKey]);

  /** 切換月份：只讀本機，不連 Supabase */
  useEffect(() => {
    const loaded = rowsForMonthKey(monthKey, year, month);
    rowsRef.current = loaded;
    setRowsState(loaded);
    setReady(true);
    remoteUpdatedAtRef.current = null;
    skipCloudDirtyOnceRef.current = true;
    markCloudClean();
    setCloudConflict(null);
    setSyncMessage(null);
    setSyncStatus(organizationId ? "local_saved" : "local_only");
  }, [monthKey, year, month, organizationId]);

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
        s === "conflict" || s === "syncing" ? s : "local_saved",
      );
      return;
    }
    markCloudDirty();
  }, [rows, monthKey, ready, organizationId]);

  const applyCloudVersion = useCallback(() => {
    if (!cloudConflict) return;
    const remoteRows = sortRowsByDate(cloudConflict.rows);
    const next = mergeMonthRowsPreferRicher(rowsRef.current, remoteRows);
    remoteUpdatedAtRef.current = cloudConflict.updatedAt;
    setRows(next);
    setCloudConflict(null);
    markCloudClean();
    setSyncStatus("synced");
    setSyncMessage(null);
  }, [cloudConflict, monthKey]);

  const dismissCloudConflict = useCallback(() => {
    setCloudConflict(null);
    setSyncMessage(null);
    setSyncStatus(cloudDirtyRef.current ? "cloud_pending" : "local_saved");
  }, []);

  /** 唯一寫入 Supabase 的入口（手動） */
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
      const result = await saveLedgerMonth(monthKey, current, null);

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
    applyCloudVersion,
    dismissCloudConflict,
    saveToCloud,
    persistBeforeShare,
  };
}
