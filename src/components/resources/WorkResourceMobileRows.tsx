"use client";

import {
  WORK_RESOURCE_CATEGORIES,
  type WorkResourceCategoryKey,
  type WorkResourceComputedRow,
  type WorkResourceMonthTotals,
} from "@/lib/work-resources";

function formatSigned(n: number): string {
  if (n === 0) return "0";
  const abs = n.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
  return n > 0 ? abs : `−${abs}`;
}

export function WorkResourceMobileRows({
  rows,
  totals,
  formatNum,
  parseNum,
  updateRow,
  updateCount,
  openRowMenu,
  onNoteContextMenu,
}: {
  rows: WorkResourceComputedRow[];
  totals: WorkResourceMonthTotals;
  formatNum: (n: number) => string;
  parseNum: (raw: string) => number;
  updateRow: (id: string, patch: { date?: string; note?: string }) => void;
  updateCount: (
    id: string,
    category: WorkResourceCategoryKey,
    value: number,
  ) => void;
  openRowMenu: (rowId: string, anchor: HTMLElement) => void;
  onNoteContextMenu: (e: React.MouseEvent, rowId: string) => void;
}) {
  return (
    <div className="space-y-3 pb-4">
      {rows.map((row) => (
        <article
          key={row.id}
          className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
        >
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={row.date}
              onChange={(e) => updateRow(row.id, { date: e.target.value })}
              className="ledger-touch-input min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              className="ledger-touch-btn shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800"
              onClick={(e) => openRowMenu(row.id, e.currentTarget)}
            >
              列操作
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {WORK_RESOURCE_CATEGORIES.map(({ key, label, sign }) => (
              <label
                key={key}
                className="block rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2"
              >
                <span className="text-xs font-medium text-slate-600">
                  {label}
                  <span className="ml-0.5 text-slate-400">
                    ({sign > 0 ? "加" : "減"})
                  </span>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNum(row.counts[key])}
                  placeholder="0"
                  onChange={(e) =>
                    updateCount(row.id, key, parseNum(e.target.value))
                  }
                  className="ledger-touch-input mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-right text-base tabular-nums"
                />
              </label>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-emerald-200/90 bg-emerald-50/90 px-3 py-2.5">
            <p className="text-[11px] font-medium text-emerald-800/90">
              當日用量（大+細−槍−漏）
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-900">
              {formatSigned(row.dailyNet)}
            </p>
          </div>

          <label className="mt-3 block">
            <span className="text-xs font-medium text-slate-600">備註</span>
            <textarea
              value={row.note}
              rows={2}
              placeholder="選填（長按可開備註選單）"
              onChange={(e) => updateRow(row.id, { note: e.target.value })}
              onContextMenu={(e) => onNoteContextMenu(e, row.id)}
              className="ledger-touch-input mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>
        </article>
      ))}

      <article className="rounded-xl border-2 border-slate-300 bg-slate-50 p-4">
        <p className="text-sm font-bold text-slate-900">本月合計</p>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {WORK_RESOURCE_CATEGORIES.map(({ key, label }) => (
            <div key={key} className="flex justify-between gap-2">
              <span className="text-slate-600">{label}</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {formatNum(totals[key]) || "0"}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <span className="text-xs font-medium text-emerald-800">本月用量加總</span>
          <span className="text-xl font-bold tabular-nums text-emerald-900">
            {formatSigned(totals.totalDailyNet)}
          </span>
        </div>
      </article>
    </div>
  );
}
