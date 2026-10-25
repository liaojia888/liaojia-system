"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAllLedgerMonths } from "@/app/actions/daily-ledger";
import type { DailyLedgerRow } from "@/lib/daily-ledger";
import { loadAllLocalMonths } from "@/lib/ledger-local-store";
import { subscribeLedgerSync } from "@/lib/ledger-sync-events";

export function useLedgerYearData({
  year,
  organizationId,
}: {
  year: number;
  organizationId: string | null;
}) {
  const [months, setMonths] = useState<Record<string, DailyLedgerRow[]>>({});
  const [ready, setReady] = useState(false);
  const [loadingCloud, setLoadingCloud] = useState(false);

  const load = useCallback(async () => {
    setReady(false);
    const prefix = `${year}-`;
    const local = loadAllLocalMonths();
    const merged: Record<string, DailyLedgerRow[]> = {};
    for (const [key, rows] of Object.entries(local)) {
      if (key.startsWith(prefix)) merged[key] = rows;
    }

    if (organizationId) {
      setLoadingCloud(true);
      const remote = await fetchAllLedgerMonths();
      setLoadingCloud(false);
      if (remote.ok) {
        for (const [monthKey, payload] of Object.entries(remote.months)) {
          if (monthKey.startsWith(prefix) && payload.rows.length) {
            merged[monthKey] = payload.rows;
          }
        }
      }
    }

    setMonths(merged);
    setReady(true);
  }, [year, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const prefix = `${year}-`;
    return subscribeLedgerSync((msg) => {
      if (msg.monthKey.startsWith(prefix)) {
        void load();
      }
    });
  }, [year, load]);

  useEffect(() => {
    let timer: number | undefined;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(), 400);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(timer);
    };
  }, [load]);

  return { months, ready, loadingCloud, reloadYear: load };
}
