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
import { subscribeLedgerSync } from "@/lib/ledger-sync-events";

export type LedgerSyncStatus =
  | "idle"
  | "loading"
  | "synced"
  | "syncing"
  | "conflict"
  | "error"
  | "local_only";

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
  const [rows, setRows] = useState<DailyLedgerRow[]>([]);
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<LedgerSyncStatus>("loading");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [cloudConflict, setCloudConflict] = useState<LedgerMonthPayload | null>(
    null,
  );
  const remoteUpdatedAtRef = useRef<string | null>(null);
  const saveGenerationRef = useRef(0);

  const loadMonth = useCallback(async () => {
    setReady(false);
    setSyncStatus("loading");
    setSyncMessage(null);
    setCloudConflict(null);

    const local = loadLocalMonth(monthKey);
    let nextRows = local?.length
      ? sortRowsByDate(local)
      : defaultRowsForMonth(year, month);

    if (!organizationId) {
      remoteUpdatedAtRef.current = null;
      setRows(nextRows);
      setSyncStatus("local_only");
      setReady(true);
      return;
    }

    const remote = await fetchLedgerMonth(monthKey);
    if (!remote.ok) {
      setRows(nextRows);
      setSyncStatus("error");
      setSyncMessage(remote.error);
      setReady(true);
      return;
    }

    if (remote.data?.rows?.length) {
      nextRows = sortRowsByDate(remote.data.rows);
      remoteUpdatedAtRef.current = remote.data.updatedAt;
      saveLocalMonth(monthKey, nextRows);
      setSyncStatus("synced");
    } else if (local?.length) {
      const push = await saveLedgerMonth(monthKey, local, null);
      if (push.ok) {
        remoteUpdatedAtRef.current = push.updatedAt;
        setSyncStatus("synced");
      } else {
        setSyncStatus("error");
        setSyncMessage(push.error);
      }
    } else {
      remoteUpdatedAtRef.current = null;
      setSyncStatus("synced");
    }

    setRows(nextRows);
    setReady(true);
  }, [monthKey, year, month, organizationId]);

  const reloadFromLocalCache = useCallback(() => {
    const local = loadLocalMonth(monthKey);
    if (!local?.length) return;
    setRows(sortRowsByDate(local));
  }, [monthKey]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    return subscribeLedgerSync((msg) => {
      if (msg.monthKey !== monthKey) return;
      reloadFromLocalCache();
    });
  }, [monthKey, reloadFromLocalCache]);

  useEffect(() => {
    let timer: number | undefined;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void loadMonth(), 400);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(timer);
    };
  }, [loadMonth]);

  useEffect(() => {
    if (!ready || rows.length === 0) return;

    saveLocalMonth(monthKey, rows);

    if (!organizationId) return;

    setSyncStatus((s) => (s === "conflict" ? s : "syncing"));
    const generation = ++saveGenerationRef.current;

    const timer = window.setTimeout(async () => {
      const result = await saveLedgerMonth(
        monthKey,
        rows,
        remoteUpdatedAtRef.current,
      );

      if (generation !== saveGenerationRef.current) return;

      if (result.ok) {
        remoteUpdatedAtRef.current = result.updatedAt;
        setCloudConflict(null);
        setSyncMessage(null);
        setSyncStatus("synced");
        return;
      }

      if (result.conflict) {
        setCloudConflict(result.conflict);
        setSyncStatus("conflict");
        setSyncMessage(result.error);
        return;
      }

      setSyncStatus("error");
      setSyncMessage(result.error);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [rows, monthKey, ready, organizationId]);

  const applyCloudVersion = useCallback(() => {
    if (!cloudConflict) return;
    const next = sortRowsByDate(cloudConflict.rows);
    remoteUpdatedAtRef.current = cloudConflict.updatedAt;
    saveLocalMonth(monthKey, next);
    setRows(next);
    setCloudConflict(null);
    setSyncStatus("synced");
    setSyncMessage(null);
  }, [cloudConflict, monthKey]);

  return {
    rows,
    setRows,
    ready,
    syncStatus,
    syncMessage,
    cloudConflict,
    reloadMonth: loadMonth,
    applyCloudVersion,
  };
}
