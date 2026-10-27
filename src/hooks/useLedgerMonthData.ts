"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { loadLocalMonth, saveLocalMonth } from "@/lib/ledger-local-store";
import { mergeMonthRowsPreferRicher } from "@/lib/ledger-row-merge";
import { subscribeLedgerSync } from "@/lib/ledger-sync-events";

export type LedgerSyncStatus =
  | "idle"
  | "loading"
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
  /** 先顯示本機／預設列，避免整頁「載入日結表…」閃爍 */
  const [ready, setReady] = useState(true);
  const [syncStatus, setSyncStatus] = useState<LedgerSyncStatus>("loading");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [cloudConflict, setCloudConflict] = useState<LedgerMonthPayload | null>(
    null,
  );
  const remoteUpdatedAtRef = useRef<string | null>(null);
  const saveGenerationRef = useRef(0);
  /** 取消過期的 loadMonth 非同步結果（Strict Mode／重複 initial 等） */
  const loadGenerationRef = useRef(0);
  /** 匯出分享進行中：禁止遠端載入覆寫畫面 */
  const shareLockRef = useRef(false);
  /** 本機有變更尚未手動上傳雲端 */
  const cloudDirtyRef = useRef(false);
  const [cloudDirty, setCloudDirty] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  /** 切換月份後第一次寫本機不算「未上傳雲端」 */
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

  function shouldApplyRowsToUi(): boolean {
    return !shareLockRef.current;
  }
  const loadMonth = useCallback(
    async (
      mode: "initial" | "background" = "initial",
      options?: { userReload?: boolean; applyRemoteRows?: boolean },
    ) => {
      const loadGen =
        mode === "initial" ? ++loadGenerationRef.current : loadGenerationRef.current;
      const isStaleLoad = () =>
        mode === "initial" && loadGen !== loadGenerationRef.current;

      const local = loadLocalMonth(monthKey);
      let nextRows = local?.length
        ? sortRowsByDate(local)
        : defaultRowsForMonth(year, month);
      let applyRowsToUi = false;

      if (mode === "initial") {
        if (options?.userReload && shouldApplyRowsToUi()) {
          setRows(nextRows);
        }
        setSyncStatus(organizationId ? "loading" : "local_only");
        if (options?.userReload) {
          setSyncMessage(null);
        }
      } else {
        setSyncStatus((s) =>
          s === "conflict" || s === "syncing" ? s : "loading",
        );
      }

      if (!organizationId) {
        remoteUpdatedAtRef.current = null;
        setSyncStatus("local_only");
        return;
      }

      const remote = await fetchLedgerMonth(monthKey);
      if (isStaleLoad() || !shouldApplyRowsToUi()) {
        return;
      }

      if (!remote.ok) {
        if (mode === "initial" && options?.userReload && shouldApplyRowsToUi()) {
          setRows(nextRows);
        }
        setSyncStatus("error");
        setSyncMessage(remote.error);
        return;
      }

      if (remote.data?.rows?.length) {
        const remoteAt = remote.data.updatedAt;
        remoteUpdatedAtRef.current = remoteAt;

        if (
          options?.applyRemoteRows &&
          shouldApplyRowsToUi() &&
          !isStaleLoad()
        ) {
          const remoteRows = sortRowsByDate(remote.data.rows);
          const base = options.userReload
            ? nextRows
            : rowsRef.current;
          nextRows = mergeMonthRowsPreferRicher(base, remoteRows);
          saveLocalMonth(monthKey, nextRows);
          applyRowsToUi = true;
        }

        if (!isStaleLoad()) {
          setSyncStatus(
            cloudDirtyRef.current ? "cloud_pending" : "local_saved",
          );
        }
      } else {
        remoteUpdatedAtRef.current = null;
        if (!isStaleLoad()) {
          setSyncStatus(
            cloudDirtyRef.current ? "cloud_pending" : "local_saved",
          );
        }
      }

      if (applyRowsToUi && shouldApplyRowsToUi() && !isStaleLoad()) {
        setRows(nextRows);
      }
    },
    [monthKey, year, month, organizationId],
  );

  const reloadFromLocalCache = useCallback(() => {
    if (shareLockRef.current || cloudDirtyRef.current) return;
    const local = loadLocalMonth(monthKey);
    if (!local?.length) return;
    setRows((prev) =>
      mergeMonthRowsPreferRicher(prev, sortRowsByDate(local)),
    );
  }, [monthKey]);

  /** 僅在切換月份時從本機載入，避免 loadMonth 重跑時蓋掉正在編輯的列 */
  useEffect(() => {
    setRows(rowsForMonthKey(monthKey, year, month));
    remoteUpdatedAtRef.current = null;
    loadGenerationRef.current += 1;
    skipCloudDirtyOnceRef.current = true;
    markCloudClean();
    setCloudConflict(null);
    setSyncMessage(null);
  }, [monthKey, year, month]);

  useEffect(() => {
    if (!organizationId) {
      remoteUpdatedAtRef.current = null;
      setSyncStatus("local_only");
      return;
    }
    void loadMonth("initial");
  }, [loadMonth, organizationId]);

  useEffect(() => {
    return subscribeLedgerSync((msg) => {
      if (msg.monthKey !== monthKey) return;
      reloadFromLocalCache();
    });
  }, [monthKey, reloadFromLocalCache]);

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
        s === "loading" || s === "conflict" || s === "syncing" ? s : "local_saved",
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
        null,
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

  /** 匯出前只寫入本機（雲端請手動按「儲存至雲端」） */
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
    reloadMonth: () => loadMonth("initial", { userReload: true }),
    applyCloudVersion,
    dismissCloudConflict,
    saveToCloud,
    persistBeforeShare,
  };
}
