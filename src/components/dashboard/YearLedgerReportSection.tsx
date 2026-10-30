"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useLedgerYearData } from "@/hooks/useLedgerYearData";
import {
  aggregateYearTotals,
  buildYearMonthlyTrend,
  summarizeYearFromMonths,
  type YearMonthSummary,
} from "@/lib/ledger-analytics";
import { buildYearCsv, downloadTextFile } from "@/lib/ledger-export";
import { readLocalCompanyName } from "@/lib/company-display-name";
import {
  formatLedgerYearForWhatsApp,
  openWhatsAppShare,
  shareViaWeChat,
  weChatShareSuccessMessage,
} from "@/lib/whatsapp-export";
import { LedgerTrendChart } from "@/components/dashboard/LedgerTrendChart";
import { ReportPageSkeleton } from "@/components/dashboard/ReportPageSkeleton";

function money(n: number) {
  return n.toLocaleString("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  });
}

function ActionBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ledger-touch-btn ledger-btn-ghost rounded-full px-4 py-2 text-sm font-medium shadow-sm"
    >
      {children}
    </button>
  );
}

export function YearLedgerReportSection({
  year,
  organizationId,
  onPickMonth,
  loadingCloudHint,
}: {
  year: number;
  organizationId: string | null;
  onPickMonth: (month: number) => void;
  loadingCloudHint: (loading: boolean) => void;
}) {
  const { months, ready, loadingCloud } = useLedgerYearData({
    year,
    organizationId,
  });

  useEffect(() => {
    loadingCloudHint(loadingCloud);
  }, [loadingCloud, loadingCloudHint]);

  const summaries = useMemo(
    () => summarizeYearFromMonths(year, months),
    [year, months],
  );

  const yearTotals = useMemo(
    () => aggregateYearTotals(summaries),
    [summaries],
  );

  const yearHasData = summaries.some((s) => s.hasData);

  const yearTrendPoints = useMemo(
    () => buildYearMonthlyTrend(summaries),
    [summaries],
  );

  function exportYearCsv() {
    const csv = buildYearCsv(year, summaries, yearTotals);
    downloadTextFile(`年結-${year}.csv`, csv, "text/csv;charset=utf-8");
  }

  function shareWhatsAppYear() {
    const result = openWhatsAppShare(
      formatLedgerYearForWhatsApp(
        summaries,
        yearTotals,
        year,
        readLocalCompanyName() ?? "公司",
      ),
    );
    if (!result.ok && result.error) {
      window.alert(result.error);
    }
  }

  function shareWeChatYear() {
    void (async () => {
      const result = await shareViaWeChat(
        formatLedgerYearForWhatsApp(
          summaries,
          yearTotals,
          year,
          readLocalCompanyName() ?? "公司",
        ),
      );
      if (!result.ok && result.error) {
        window.alert(result.error);
      } else {
        window.alert(weChatShareSuccessMessage(result.mode));
      }
    })();
  }

  if (!ready) {
    return <ReportPageSkeleton />;
  }

  if (!yearHasData) {
    return (
      <div className="report-page-card rounded-2xl p-6 text-sm text-slate-600">
        {year} 年尚無日結資料。請先在{" "}
        <Link href="/dashboard" className="report-theme-link">
          日結表
        </Link>{" "}
        輸入任一月資料。
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryStat label="年度淨收入" value={money(yearTotals.totalRevenue)} accent />
        <SummaryStat label="年度支出" value={money(yearTotals.expenses)} />
        <SummaryStat
          label="待入銀行（累計）"
          value={money(yearTotals.bankPending)}
        />
        <SummaryStat
          label="期末尾數"
          value={money(yearTotals.closingBalance)}
          accent
        />
      </div>

      <div className="ledger-no-print report-page-card flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:p-5">
        <p className="text-sm text-slate-600">
          彙整 {year} 年各月日結；點柱狀或表格月份可切換至月度報表。
        </p>
        <details className="group w-full sm:w-auto">
          <summary className="ledger-touch-btn ledger-btn-ghost cursor-pointer list-none rounded-full px-4 py-2 text-sm font-medium shadow-sm [&::-webkit-details-marker]:hidden">
            分享與匯出
          </summary>
          <div className="mt-2 flex flex-wrap gap-2 sm:mt-0 sm:inline-flex">
            <ActionBtn onClick={exportYearCsv}>匯出 CSV</ActionBtn>
            <ActionBtn onClick={shareWhatsAppYear}>WhatsApp</ActionBtn>
            <ActionBtn onClick={shareWeChatYear}>微信</ActionBtn>
            <ActionBtn onClick={() => window.print()}>列印</ActionBtn>
          </div>
        </details>
      </div>

      <LedgerTrendChart
        points={yearTrendPoints}
        title={`${year} 年 各月淨收入`}
        subtitle="依各月日結加總的淨收入（產品小計 − 撤單）；無資料的月份柱高為 0，不可點選。"
        onPointClick={(p) => {
          const month = Number.parseInt(p.date.slice(5, 7), 10);
          if (p.hasData) onPickMonth(month);
        }}
        pointDisabled={(p) => !p.hasData}
      />

      <YearMonthTable
        year={year}
        summaries={summaries}
        yearTotals={yearTotals}
        onPickMonth={onPickMonth}
      />
    </>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 shadow-sm backdrop-blur-sm ${
        accent ? "ledger-stat-accent" : "border-white/60 bg-white/70"
      }`}
    >
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="ledger-stat-value mt-1 text-xl font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

function YearMonthTable({
  year,
  summaries,
  yearTotals,
  onPickMonth,
}: {
  year: number;
  summaries: YearMonthSummary[];
  yearTotals: ReturnType<typeof aggregateYearTotals>;
  onPickMonth: (month: number) => void;
}) {
  return (
    <section className="report-page-card overflow-x-auto rounded-2xl p-4 sm:p-5">
      <h2 className="report-block-title text-base font-semibold">月份明細</h2>
      <table className="mt-4 min-w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-600">
            <th className="pb-2 pr-4 font-medium">月份</th>
            <th className="pb-2 pr-4 text-right font-medium">淨收入</th>
            <th className="pb-2 pr-4 text-right font-medium">支出</th>
            <th className="pb-2 text-right font-medium">期末尾數</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s) => (
            <tr key={s.monthKey} className="border-t border-slate-100">
              <td className="py-2 pr-4">
                {s.hasData ? (
                  <button
                    type="button"
                    onClick={() => onPickMonth(s.month)}
                    className="report-theme-link font-medium"
                  >
                    {year} 年 {s.month} 月
                  </button>
                ) : (
                  <span className="text-slate-400">
                    {year} 年 {s.month} 月
                  </span>
                )}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {s.hasData ? money(s.totals.totalRevenue) : "—"}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {s.hasData ? money(s.totals.expenses) : "—"}
              </td>
              <td className="py-2 text-right tabular-nums">
                {s.hasData ? money(s.totals.closingBalance) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-300 font-semibold">
            <td className="py-3 pr-4">年度合計</td>
            <td className="py-3 pr-4 text-right tabular-nums">
              {money(yearTotals.totalRevenue)}
            </td>
            <td className="py-3 pr-4 text-right tabular-nums">
              {money(yearTotals.expenses)}
            </td>
            <td className="py-3 text-right tabular-nums">
              {money(yearTotals.closingBalance)}
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
