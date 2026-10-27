"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [rows, setRows] = useState(() =>
    rowsForMonthKey(monthKey, year, month),
  );
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [ready, setReady] = useState(true);
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
    if (!local?.length) return;
    setRows((prev) =>
      mergeMonthRowsPreferRicher(prev, sortRowsByDate(local)),
    );
  }, [monthKey]);

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
    setRows(rowsForMonthKey(monthKey, year, month));
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
      if (msg.monthKey !== monthKey) return;
      reloadFromLocalCache();
    });
  }, [monthKey, reloadFromLocalCache]);

  /** 編輯 → 只寫瀏覽器本機，不寫 Supabase */
  useEffect(() => {
    if (!ready || rows.length === 0) return;

    saveLocalMonth(monthKey, rows);
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
    saveLocalMonth(monthKey, next);
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
