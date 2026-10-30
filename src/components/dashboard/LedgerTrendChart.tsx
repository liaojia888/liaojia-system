"use client";

import type { DailyTrendPoint } from "@/lib/ledger-analytics";

function moneyShort(n: number) {
  const abs = Math.abs(n);
  if (abs >= 10000) return `${(n / 10000).toFixed(1)}萬`;
  return n.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

export function LedgerTrendChart({
  points,
  title = "每日淨收入",
  subtitle = "依日結列加總的淨收入（產品小計 − 撤單）；區間內每一天皆顯示，無資料日為 0。",
  onPointClick,
  pointDisabled,
}: {
  points: DailyTrendPoint[];
  title?: string;
  subtitle?: string;
  onPointClick?: (point: DailyTrendPoint) => void;
  pointDisabled?: (point: DailyTrendPoint) => boolean;
}) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-slate-500">此區間尚無可繪製的收入資料。</p>
    );
  }

  const maxAbs = Math.max(...points.map((p) => Math.abs(p.totalRevenue)), 1);

  return (
    <section className="report-page-card rounded-2xl p-4 sm:p-5">
      <h2 className="report-block-title text-base font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-slate-500 sm:text-sm">{subtitle}</p>
      <div
        className="mt-4 flex items-end gap-1 overflow-x-auto pb-2"
        role="img"
        aria-label={title}
      >
        {points.map((p) => {
          const h = Math.max(4, Math.round((Math.abs(p.totalRevenue) / maxAbs) * 96));
          const negative = p.totalRevenue < 0;
          const disabled = pointDisabled?.(p) ?? false;
          const titleText = `${p.date}：${p.totalRevenue.toLocaleString("zh-TW")} 元`;

          const bar = (
            <>
              <span
                className={`text-[10px] tabular-nums ${
                  negative ? "text-red-600" : "text-slate-500"
                }`}
              >
                {moneyShort(p.totalRevenue)}
              </span>
              <div
                className={`w-6 rounded-t-md ${
                  negative ? "bg-red-400/90" : "ledger-trend-bar"
                } ${disabled ? "opacity-40" : ""}`}
                style={{ height: `${h}px` }}
              />
              <span className="text-[10px] font-medium text-slate-600">
                {p.label}
              </span>
            </>
          );

          if (onPointClick && !disabled) {
            return (
              <button
                key={p.date}
                type="button"
                onClick={() => onPointClick(p)}
                className="flex min-w-[2rem] flex-col items-center gap-1 rounded-md transition hover:bg-slate-50"
                title={titleText}
              >
                {bar}
              </button>
            );
          }

          return (
            <div
              key={p.date}
              className={`flex min-w-[2rem] flex-col items-center gap-1 ${
                disabled ? "opacity-50" : ""
              }`}
              title={titleText}
            >
              {bar}
            </div>
          );
        })}
      </div>
    </section>
  );
}
