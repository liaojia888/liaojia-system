"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchLedgerChangeLogs,
  type LedgerChangeLogEntry,
} from "@/app/actions/daily-ledger";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionLabel(action: LedgerChangeLogEntry["action"]) {
  return action === "import" ? "備份匯入" : "Supabase 儲存";
}

/** 本機時區「今天」00:00～23:59:59.999，供 Supabase 篩選 */
function localTodayBounds() {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  const dayLabel = start.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  return {
    createdAfter: start.toISOString(),
    createdBefore: end.toISOString(),
    dayLabel,
  };
}

export function LedgerAuditLogPanel() {
  const [entries, setEntries] = useState<LedgerChangeLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dayLabel, setDayLabel] = useState(() => localTodayBounds().dayLabel);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const bounds = localTodayBounds();
    setDayLabel(bounds.dayLabel);
    const result = await fetchLedgerChangeLogs({
      limit: 100,
      createdAfter: bounds.createdAfter,
      createdBefore: bounds.createdBefore,
    });
    if (result.ok) {
      setEntries(result.entries);
    } else {
      setError(result.error);
      setEntries([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="report-page-card rounded-2xl border p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">日結審計紀錄</h2>
          <p className="mt-1 text-sm text-slate-600">
            僅顯示<strong className="font-medium text-slate-800">{dayLabel}</strong>
            （本機時區）寫入 Supabase 的紀錄。同一使用者、同一月份約 15
            分鐘內只記一筆，避免洗版。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="ledger-touch-btn ledger-btn-ghost rounded-full px-4 py-2 text-sm font-medium shadow-sm disabled:opacity-60"
        >
          {loading ? "載入中…" : "重新整理"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600">
          {error.includes("daily_ledger_change_log")
            ? "審計表尚未建立。請在 Supabase SQL Editor 執行 supabase/migrations/004_ledger_audit_log.sql。"
            : error}
        </p>
      ) : null}

      {!error && !loading && entries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          今日尚無紀錄。成功寫入 Supabase 或匯入備份後會出現在此。
        </p>
      ) : null}

      {entries.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-600">
                <th className="pb-2 pr-4 font-medium">時間</th>
                <th className="pb-2 pr-4 font-medium">月份</th>
                <th className="pb-2 pr-4 font-medium">操作</th>
                <th className="pb-2 pr-4 font-medium">操作者</th>
                <th className="pb-2 font-medium">列數</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="py-2 pr-4 whitespace-nowrap tabular-nums text-slate-800">
                    {formatWhen(row.createdAt)}
                  </td>
                  <td className="py-2 pr-4 font-medium">{row.monthKey}</td>
                  <td className="py-2 pr-4">{actionLabel(row.action)}</td>
                  <td className="py-2 pr-4">
                    {row.actorName ??
                      (row.changedBy
                        ? `${row.changedBy.slice(0, 8)}…`
                        : "（未知）")}
                  </td>
                  <td className="py-2 tabular-nums">
                    {row.rowCount ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
