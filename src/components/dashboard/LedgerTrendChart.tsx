"use client";

import type { DailyTrendPoint } from "@/lib/ledger-analytics";

function moneyShort(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}萬`;
  return n.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

export function LedgerTrendChart({
  points,
  title = "每日總收入趨勢",
}: {
  points: DailyTrendPoint[];
  title?: string;
}) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-slate-500">此區間尚無可繪製的收入資料。</p>
    );
  }

  const max = Math.max(...points.map((p) => p.totalRevenue), 1);

  return (
    <section className="report-page-card rounded-2xl p-4 sm:p-5">
      <h2 className="report-block-title text-base font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-slate-500 sm:text-sm">
        依日結列加總的「總收入」（含撤單扣減後）。
      </p>
      <div
        className="mt-4 flex items-end gap-1 overflow-x-auto pb-2"
        role="img"
        aria-label={title}
      >
        {points.map((p) => {
          const h = Math.max(4, Math.round((p.totalRevenue / max) * 96));
          return (
            <div
              key={p.date}
              className="flex min-w-[2rem] flex-col items-center gap-1"
              title={`${p.date}：${p.totalRevenue.toLocaleString("zh-TW")} 元`}
            >
              <span className="text-[10px] tabular-nums text-slate-500">
                {moneyShort(p.totalRevenue)}
              </span>
              <div
                className="ledger-trend-bar w-6 rounded-t-md"
                style={{ height: `${h}px` }}
              />
              <span className="text-[10px] font-medium text-slate-600">
                {p.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
