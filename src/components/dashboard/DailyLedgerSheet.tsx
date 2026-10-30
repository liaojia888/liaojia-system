"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  computeRows,
  computeTotals,
  createEmptyRow,
  createEmptyFpsEntry,
  createEmptyExpenseEntry,
  sortRowsByDate,
  FPS_CHANNEL_OPTIONS,
  isLedgerRowActive,
  type DailyLedgerRow,
  type DailyLedgerTotals,
  type ExpenseEntry,
  type FpsChannel,
  type FpsEntry,
  type LedgerNoteKey,
  type LedgerNotes,
} from "@/lib/daily-ledger";
import {
  LedgerNoteContextMenu,
  LedgerNoteEditor,
  type ContextMenuState,
  type NoteTarget,
  type SheetContextNoteKey,
} from "@/components/dashboard/LedgerNoteMenus";
import { NotableAmountCell } from "@/components/dashboard/NotableAmountCell";
import { readLocalCompanyName } from "@/lib/company-display-name";
import {
  formatLedgerMonthForWhatsApp,
  formatLedgerRowForWhatsApp,
  openWhatsAppShare,
  shareViaWeChat,
  weChatShareSuccessMessage,
} from "@/lib/whatsapp-export";
import { DailyLedgerMobileRows } from "@/components/dashboard/DailyLedgerMobileRows";
import { LedgerUnifiedOutflowEditor } from "@/components/dashboard/LedgerUnifiedOutflowEditor";
import { useLedgerLayout } from "@/components/providers/LedgerLayoutProvider";
import { layoutUsesMobileSpreadsheet } from "@/lib/ledger-layout";
import { useLedgerMonthData } from "@/hooks/useLedgerMonthData";
import { buildMonthCsv, downloadTextFile } from "@/lib/ledger-export";

function formatNum(n: number): string {
  if (!n) return "";
  return n.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

function parseNum(raw: string): number {
  const v = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(v) ? v : 0;
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function isLedgerNoteKey(key: SheetContextNoteKey): key is LedgerNoteKey {
  return key !== "rowNote";
}

const REVENUE_FIELDS = ["fuel", "water", "urea"] as const;
const OTHER_PAYMENT_FIELDS = [
  "bankDeposited",
  "bankPending",
  "cancelled",
] as const;

type LineEntryNoteTarget = {
  fpsEntryId?: string;
  expenseEntryId?: string;
};

export function DailyLedgerSheet({
  organizationId,
}: {
  organizationId: string | null;
}) {
  const { layout: ledgerLayout } = useLedgerLayout();
  const isWorkbench = ledgerLayout === "workbench";
  const isMobileSpreadsheet = layoutUsesMobileSpreadsheet(ledgerLayout);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [noteEditor, setNoteEditor] = useState<
    (NoteTarget & { initialText: string }) | null
  >(null);

  const key = monthKey(year, month);

  const {
    rows,
    setRows,
    ready,
    syncStatus,
    syncMessage,
    cloudConflict,
    applyCloudVersion,
    dismissCloudConflict,
    reloadMonth,
    pullCloudMonth,
    persistBeforeShare,
    saveToCloud,
    cloudDirty,
    isSavingCloud,
  } = useLedgerMonthData({
    monthKey: key,
    year,
    month,
    organizationId,
  });

  const computed = useMemo(() => computeRows(sortRowsByDate(rows)), [rows]);
  const totals = useMemo(() => computeTotals(computed), [computed]);

  const updateRow = useCallback(
    (id: string, patch: Partial<DailyLedgerRow>) => {
      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

  const updateNote = useCallback(
    (
      rowId: string,
      noteKey: LedgerNoteKey,
      text: string,
      entryTarget?: LineEntryNoteTarget,
    ) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const trimmed = text.trim();
          if (entryTarget?.fpsEntryId) {
            const fpsEntries = row.fpsEntries.map((entry) => {
              if (entry.id !== entryTarget.fpsEntryId) return entry;
              if (trimmed) return { ...entry, note: trimmed };
              const { note: _n, ...rest } = entry;
              return rest;
            });
            return { ...row, fpsEntries };
          }
          if (entryTarget?.expenseEntryId) {
            const expenseEntries = row.expenseEntries.map((entry) => {
              if (entry.id !== entryTarget.expenseEntryId) return entry;
              if (trimmed) return { ...entry, note: trimmed };
              const { note: _n, ...rest } = entry;
              return rest;
            });
            return { ...row, expenseEntries };
          }
          const notes: LedgerNotes = { ...row.notes };
          if (trimmed) notes[noteKey] = trimmed;
          else delete notes[noteKey];
          return { ...row, notes };
        }),
      );
    },
    [],
  );

  const setFpsEntries = useCallback(
    (rowId: string, fpsEntries: FpsEntry[]) => {
      updateRow(rowId, { fpsEntries });
    },
    [updateRow],
  );

  const setExpenseEntries = useCallback(
    (rowId: string, expenseEntries: ExpenseEntry[]) => {
      updateRow(rowId, { expenseEntries });
    },
    [updateRow],
  );

  const openContextMenu = useCallback(
    (
      e: React.MouseEvent,
      rowId: string,
      noteKey: LedgerNoteKey,
      entryTarget?: LineEntryNoteTarget,
    ) => {
      e.preventDefault();
      setContextMenu({
        rowId,
        noteKey,
        fpsEntryId: entryTarget?.fpsEntryId,
        expenseEntryId: entryTarget?.expenseEntryId,
        x: e.clientX,
        y: e.clientY,
      });
    },
    [],
  );

  const openRowContextMenu = useCallback((e: React.MouseEvent, rowId: string) => {
    e.preventDefault();
    setContextMenu({
      rowId,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  const openMenuFromAnchor = useCallback(
    (
      rowId: string,
      noteKey: LedgerNoteKey | undefined,
      anchor: HTMLElement,
      entryTarget?: LineEntryNoteTarget,
    ) => {
      const rect = anchor.getBoundingClientRect();
      setContextMenu({
        rowId,
        noteKey,
        fpsEntryId: entryTarget?.fpsEntryId,
        expenseEntryId: entryTarget?.expenseEntryId,
        x: Math.min(rect.left, window.innerWidth - 200),
        y: rect.bottom + 4,
      });
    },
    [],
  );

  const clearRow = useCallback((rowId: string) => {
    if (!confirm("確定要清空這一行的所有金額、轉數快與備註？（日期保留）")) {
      return;
    }
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        return { ...createEmptyRow(row.date), id: row.id };
      }),
    );
  }, []);

  const insertRowAfter = useCallback((rowId: string) => {
    setRows((prev) => {
      const sorted = sortRowsByDate(prev);
      const index = sorted.findIndex((r) => r.id === rowId);
      if (index === -1) return prev;
      const anchor = sorted[index];
      const newRow = createEmptyRow(anchor.date);
      const next = [...sorted];
      next.splice(index + 1, 0, newRow);
      return next;
    });
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setRows((prev) => {
      if (prev.length <= 1) {
        alert("至少需保留一列。");
        return prev;
      }
      if (!confirm("確定要移除此列？（含該列所有資料）")) {
        return prev;
      }
      return prev.filter((row) => row.id !== rowId);
    });
  }, []);

  const getNote = useCallback(
    (row: DailyLedgerRow, noteKey: LedgerNoteKey) => row.notes?.[noteKey],
    [],
  );

  const contextNoteText = useMemo(() => {
    if (!contextMenu) return "";
    const row = rows.find((r) => r.id === contextMenu.rowId);
    if (!row || !contextMenu.noteKey || !isLedgerNoteKey(contextMenu.noteKey)) {
      return "";
    }
    if (contextMenu.fpsEntryId) {
      return (
        row.fpsEntries.find((e) => e.id === contextMenu.fpsEntryId)?.note ?? ""
      );
    }
    if (contextMenu.expenseEntryId) {
      return (
        row.expenseEntries.find((e) => e.id === contextMenu.expenseEntryId)
          ?.note ?? ""
      );
    }
    return getNote(row, contextMenu.noteKey) ?? "";
  }, [contextMenu, rows, getNote]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const syncLabel =
    syncStatus === "syncing"
        ? isSavingCloud
          ? "寫入 Supabase…"
          : "正在從 Supabase 同步…"
        : syncStatus === "synced"
          ? "已與 Supabase 同步"
          : syncStatus === "cloud_pending"
            ? "已存本機 · 請按「儲存至 Supabase」更新資料庫"
            : syncStatus === "local_saved"
              ? "已存本機 · 資料庫尚無本月備份"
              : syncStatus === "local_only"
                ? "僅本機（未連公司）"
                : syncStatus === "conflict"
                  ? "Supabase 版本衝突"
                  : syncStatus === "error"
                    ? "Supabase 儲存失敗"
                    : "";

  async function handleSaveToCloud() {
    const result = await saveToCloud();
    if (!result.ok) {
      alert(result.error);
    }
  }

  const saveSupabaseControl = organizationId ? (
    <button
      type="button"
      onClick={() => void handleSaveToCloud()}
      disabled={isSavingCloud}
      className="ledger-touch-btn ledger-btn-primary h-11 w-full rounded-xl px-4 text-sm font-semibold shadow-sm"
    >
      {isSavingCloud ? "寫入 Supabase…" : "儲存至 Supabase"}
    </button>
  ) : (
    <Link
      href="/settings"
      className="ledger-touch-btn ledger-btn-primary inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold shadow-sm"
    >
      至設定建立公司
    </Link>
  );

  function exportCsv() {
    const csv = buildMonthCsv(key, sortRowsByDate(rows), computed);
    downloadTextFile(`日結-${key}.csv`, csv, "text/csv;charset=utf-8");
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        載入日結表…
      </div>
    );
  }

  return (
    <div className="ledger-workspace flex min-h-0 flex-1 flex-col">
      <header
        className={
          isWorkbench
            ? "ledger-hero rounded-b-2xl px-3 py-3 sm:px-5 sm:py-4"
            : "ledger-hero rounded-b-2xl px-4 py-5 sm:px-6 lg:px-8 lg:py-6"
        }
      >
        <div
          className={
            isWorkbench
              ? "flex flex-wrap items-center justify-between gap-3"
              : "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
          }
        >
          <div className="min-w-0 flex-1">
            {!isWorkbench ? (
              <p className="ledger-hero-kicker text-[10px] font-bold uppercase tracking-[0.25em] sm:text-xs">
                Daily Ledger
              </p>
            ) : null}
            <h1
              className={
                isWorkbench
                  ? "text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl"
                  : "mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl"
              }
            >
              {year} 年 {month} 月
              {isWorkbench ? (
                <span className="ml-2 text-sm font-medium text-slate-600">
                  工作台
                </span>
              ) : null}
              {isMobileSpreadsheet ? (
                <span className="ml-2 text-sm font-medium text-emerald-800">
                  支出明細試算表
                </span>
              ) : null}
            </h1>
            {!isWorkbench ? (
              <p className="mt-0.5 text-sm font-medium text-slate-600">
                營收對帳表
              </p>
            ) : null}
          </div>

          <div
            className="inline-flex shrink-0 self-start rounded-xl border border-slate-200/90 bg-white/90 p-1 shadow-sm"
            role="group"
            aria-label="切換月份"
          >
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="ledger-touch-btn rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              上個月
            </button>
            <span className="flex min-w-[5.5rem] items-center justify-center border-x border-slate-200/80 px-2 text-sm font-semibold tabular-nums text-slate-900">
              {String(month).padStart(2, "0")}/{year}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="ledger-touch-btn rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              下個月
            </button>
          </div>
        </div>

        {(syncLabel || syncMessage) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {syncLabel ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200/80 bg-white/95 px-3 py-1 text-xs font-medium text-emerald-900">
                {syncLabel}
              </span>
            ) : null}
            {syncMessage ? (
              <span className="text-xs text-amber-800">{syncMessage}</span>
            ) : null}
          </div>
        )}

        {!isWorkbench ? (
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-500">
            <span className="hidden lg:inline">
              右鍵可管理列與備註；轉數快／支出每筆可「＋備註」。
            </span>
            <span className="lg:hidden">
              {isMobileSpreadsheet
                ? "左右滑動；日期旁「⋯」列操作；轉數快、銀行、撤單、其他支出合併在「支出明細」欄。"
                : "每列「列操作」或「＋備註」。"}
            </span>
            {organizationId ? (
            <span className="mt-1 block text-slate-600">
              登入後會從 Supabase 載入；編輯即存本機，改動後請按「儲存至 Supabase」。
              其他裝置在日結頁開著時約每 30 秒自動更新，或按「從 Supabase 更新」立即對齊。
            </span>
            ) : (
              <span className="mt-1 block text-slate-600">
                編輯即存本機；請至設定建立公司後可存 Supabase。
              </span>
            )}
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-600">
            每日卡片編輯；一改即存本機。可在{" "}
            <Link href="/settings" className="font-medium text-emerald-800 underline">
              系統設定
            </Link>{" "}
            改回試算表視圖。
          </p>
        )}

        <div
          className={
            isWorkbench
              ? "mt-3 flex flex-wrap items-stretch gap-2"
              : "mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-stretch"
          }
        >
          <div
            className={
              isWorkbench
                ? "min-w-[11rem] flex-1 sm:flex-none sm:min-w-[12rem]"
                : "col-span-2 hidden min-w-[11rem] sm:block"
            }
          >
            {saveSupabaseControl}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="ledger-touch-btn ledger-btn-ghost h-11 rounded-xl px-4 text-sm font-medium shadow-sm"
          >
            匯出 CSV
          </button>
          <button
            type="button"
            onClick={() => setShowAllNotes((v) => !v)}
            className={`ledger-touch-btn h-11 rounded-xl px-4 text-sm font-medium shadow-sm ${
              showAllNotes
                ? "border border-amber-300/80 bg-amber-50 text-amber-900"
                : "ledger-btn-ghost"
            }`}
          >
            {showAllNotes ? "隱藏備註" : "顯示備註"}
          </button>
          {organizationId ? (
            <button
              type="button"
              onClick={() => void pullCloudMonth()}
              className="ledger-touch-btn ledger-btn-ghost h-11 rounded-xl px-4 text-sm font-medium shadow-sm"
            >
              從 Supabase 更新
            </button>
          ) : null}
        </div>

        {cloudConflict ? (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Supabase 上的版本與您目前畫面不同（常見於尚未按「儲存至 Supabase」或資料庫只有舊資料）。
              請保留本機並按「儲存至 Supabase」覆寫資料庫；若要以資料庫為準再選合併。
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={dismissCloudConflict}
                className="rounded-full bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white"
              >
                保留本機畫面
              </button>
              <button
                type="button"
                onClick={() => void reloadMonth()}
                className="rounded-full border border-amber-400 px-3 py-1.5 text-xs font-medium"
              >
                重讀本機快取
              </button>
              <button
                type="button"
                onClick={applyCloudVersion}
                className="rounded-full border border-amber-600 px-3 py-1.5 text-xs font-medium"
              >
                合併 Supabase 資料
              </button>
            </div>
          </div>
        ) : null}

        <div
          className={
            isWorkbench
              ? "mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
              : "mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"
          }
        >
          <SummaryChip label="淨收入（扣撤單）" value={totals.totalRevenue} highlight />
          <SummaryChip label="總支出" value={totals.expenses} />
          <SummaryChip label="待入銀行合計" value={totals.bankPending} />
          <SummaryChip label="期末尾數" value={totals.closingBalance} highlight />
        </div>
      </header>

      <div
        className={
          isWorkbench
            ? "min-h-0 flex-1 overflow-auto p-3 pb-24 sm:p-4 sm:pb-24"
            : "min-h-0 flex-1 overflow-auto p-3 pb-28 sm:p-4 sm:pb-6 lg:p-6"
        }
      >
        <div
          className={
            isMobileSpreadsheet
              ? "hidden"
              : isWorkbench
                ? "block"
                : "lg:hidden"
          }
        >
          <DailyLedgerMobileRows
            rows={computed}
            totals={totals}
            showAllNotes={showAllNotes}
            formatNum={formatNum}
            parseNum={parseNum}
            getNote={getNote}
            updateRow={updateRow}
            openRowMenu={(rowId, el) => openMenuFromAnchor(rowId, undefined, el)}
            openCellMenu={(rowId, noteKey, el, entryTarget) =>
              openMenuFromAnchor(rowId, noteKey, el, entryTarget)
            }
            setFpsEntries={setFpsEntries}
            setExpenseEntries={setExpenseEntries}
          />
        </div>

        <div
          className={
            isWorkbench
              ? "hidden"
              : isMobileSpreadsheet
                ? "block"
                : "hidden lg:block"
          }
        >
          <p
            className={`mb-2 text-center text-xs text-slate-500 ${
              isMobileSpreadsheet ? "lg:hidden" : "xl:hidden"
            }`}
          >
            ← 左右滑動可查看更多欄位 →
          </p>
          <div className="ledger-table-scroll ledger-table-shell overflow-x-auto overscroll-x-contain rounded-2xl bg-white">
          <div className="inline-block min-w-full align-top">
          <table
            className={`w-full border-collapse text-sm ${
              isMobileSpreadsheet ? "min-w-[720px]" : "min-w-[1100px]"
            }`}
          >
            <thead>
              {isMobileSpreadsheet ? (
                <tr className="ledger-thead-row-main">
                  <th className="ledger-th ledger-sticky-col sticky left-0 z-20 min-w-[7.5rem]">
                    日期
                  </th>
                  <th className="ledger-th">油</th>
                  <th className="ledger-th">水</th>
                  <th className="ledger-th">尿素</th>
                  <th className="ledger-th ledger-th-accent min-w-[5rem]">
                    總收入
                  </th>
                  <th className="ledger-th min-w-[18rem]">
                    支出明細
                    <span className="block text-[10px] font-normal opacity-90">
                      轉數快 · 銀行 · 撤單 · 其他
                    </span>
                  </th>
                  <th className="ledger-th ledger-th-accent min-w-[5rem]">
                    當日尾數
                    <span className="block text-[10px] font-normal opacity-90">
                      逐日累計
                    </span>
                  </th>
                </tr>
              ) : (
                <>
                  <tr className="ledger-thead-row-main">
                    <th
                      rowSpan={2}
                      className="ledger-th ledger-sticky-col sticky left-0 z-20 min-w-[7.5rem]"
                    >
                      日期
                    </th>
                    <th colSpan={3} className="ledger-th">
                      收入明細
                    </th>
                    <th
                      rowSpan={2}
                      className="ledger-th ledger-th-accent min-w-[5.5rem]"
                    >
                      總收入
                    </th>
                    <th colSpan={2} className="ledger-th">
                      轉數快（FPS）
                    </th>
                    <th rowSpan={2} className="ledger-th">
                      已入銀行
                      <span className="block text-[10px] font-normal opacity-90">
                        公司
                      </span>
                    </th>
                    <th rowSpan={2} className="ledger-th">
                      待入銀行
                      <span className="block text-[10px] font-normal opacity-90">
                        公司
                      </span>
                    </th>
                    <th rowSpan={2} className="ledger-th">
                      撤單
                    </th>
                    <th rowSpan={2} className="ledger-th min-w-[11rem]">
                      支出
                      <span className="block text-[10px] font-normal opacity-90">
                        可多筆
                      </span>
                    </th>
                    <th
                      rowSpan={2}
                      className="ledger-th ledger-th-accent min-w-[5.5rem]"
                    >
                      當日尾數
                      <span className="block text-[10px] font-normal opacity-90">
                        逐日累計
                      </span>
                    </th>
                  </tr>
                  <tr className="ledger-thead-row-sub">
                    <th className="ledger-th-sub">油</th>
                    <th className="ledger-th-sub">水</th>
                    <th className="ledger-th-sub">尿素</th>
                    <th className="ledger-th-sub min-w-[7.5rem]">收款方式</th>
                    <th className="ledger-th-sub min-w-[5.5rem]">金額</th>
                  </tr>
                </>
              )}
            </thead>
            <tbody>
              {computed.map((row) => (
                <tr
                  key={row.id}
                  data-ledger-date={row.date}
                  className="group hover:bg-emerald-50/40"
                >
                  <td
                    className="ledger-td ledger-sticky-col sticky left-0 z-10 bg-white group-hover:bg-emerald-50/40"
                    onContextMenu={(e) => openRowContextMenu(e, row.id)}
                  >
                    <div className="flex min-w-[7.5rem] items-center gap-1">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) =>
                          updateRow(row.id, { date: e.target.value })
                        }
                        className={`ledger-input min-w-0 flex-1 text-left ${
                          isMobileSpreadsheet ? "ledger-touch-input" : "w-full min-w-[7rem]"
                        }`}
                      />
                      {isMobileSpreadsheet ? (
                        <button
                          type="button"
                          className="ledger-touch-btn shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-medium text-slate-700 lg:hidden"
                          aria-label="列操作"
                          onClick={(e) =>
                            openMenuFromAnchor(
                              row.id,
                              undefined,
                              e.currentTarget,
                            )
                          }
                        >
                          ⋯
                        </button>
                      ) : null}
                    </div>
                  </td>
                  {REVENUE_FIELDS.map((field) => (
                    <NotableAmountCell
                      key={field}
                      noteKey={field}
                      note={getNote(row, field)}
                      showAllNotes={showAllNotes}
                      value={row[field]}
                      formatNum={formatNum}
                      parseNum={parseNum}
                      onValueChange={(v) => updateRow(row.id, { [field]: v })}
                      onContextMenu={(e, noteKey) =>
                        openContextMenu(e, row.id, noteKey)
                      }
                    />
                  ))}
                  <td
                    className="ledger-td computed"
                    onContextMenu={(e) => openRowContextMenu(e, row.id)}
                  >
                    {formatNum(row.productSubtotal)}
                  </td>
                  {isMobileSpreadsheet ? (
                    <td
                      className="ledger-td align-top"
                      onContextMenu={(e) => openRowContextMenu(e, row.id)}
                    >
                      <LedgerUnifiedOutflowEditor
                        row={row}
                        showAllNotes={showAllNotes}
                        formatNum={formatNum}
                        parseNum={parseNum}
                        getNote={getNote}
                        onPatch={(patch) => updateRow(row.id, patch)}
                        onFpsChange={(fpsEntries) =>
                          setFpsEntries(row.id, fpsEntries)
                        }
                        onExpenseChange={(expenseEntries) =>
                          setExpenseEntries(row.id, expenseEntries)
                        }
                        onAmountContextMenu={(e, target) => {
                          if (target.kind === "fps") {
                            openContextMenu(e, row.id, "fpsAmount", {
                              fpsEntryId: target.entryId,
                            });
                          } else {
                            openContextMenu(e, row.id, "expenses", {
                              expenseEntryId: target.entryId,
                            });
                          }
                        }}
                        onEditFpsNote={(entryId) => {
                          const entry = row.fpsEntries.find(
                            (e) => e.id === entryId,
                          );
                          setNoteEditor({
                            rowId: row.id,
                            noteKey: "fpsAmount",
                            fpsEntryId: entryId,
                            initialText: entry?.note ?? "",
                          });
                        }}
                        onEditExpenseNote={(entryId) => {
                          const entry = row.expenseEntries.find(
                            (e) => e.id === entryId,
                          );
                          setNoteEditor({
                            rowId: row.id,
                            noteKey: "expenses",
                            expenseEntryId: entryId,
                            initialText: entry?.note ?? "",
                          });
                        }}
                        onBankContextMenu={(e, noteKey) =>
                          openContextMenu(e, row.id, noteKey)
                        }
                        onEditBankNote={(noteKey) => {
                          setNoteEditor({
                            rowId: row.id,
                            noteKey,
                            initialText: getNote(row, noteKey) ?? "",
                          });
                        }}
                      />
                    </td>
                  ) : (
                    <>
                      <FpsEntriesCell
                        entries={row.fpsEntries}
                        showAllNotes={showAllNotes}
                        formatNum={formatNum}
                        parseNum={parseNum}
                        onChange={(fpsEntries) =>
                          setFpsEntries(row.id, fpsEntries)
                        }
                        onAmountContextMenu={(e, entryId) =>
                          openContextMenu(e, row.id, "fpsAmount", {
                            fpsEntryId: entryId,
                          })
                        }
                        onEditEntryNote={(entryId) => {
                          const entry = row.fpsEntries.find(
                            (e) => e.id === entryId,
                          );
                          setNoteEditor({
                            rowId: row.id,
                            noteKey: "fpsAmount",
                            fpsEntryId: entryId,
                            initialText: entry?.note ?? "",
                          });
                        }}
                        onRowContextMenu={(e) => openRowContextMenu(e, row.id)}
                      />
                      {OTHER_PAYMENT_FIELDS.map((field) => (
                        <NotableAmountCell
                          key={field}
                          noteKey={field}
                          note={getNote(row, field)}
                          showAllNotes={showAllNotes}
                          value={row[field]}
                          formatNum={formatNum}
                          parseNum={parseNum}
                          onValueChange={(v) =>
                            updateRow(row.id, { [field]: v })
                          }
                          onContextMenu={(e, noteKey) =>
                            openContextMenu(e, row.id, noteKey)
                          }
                        />
                      ))}
                      <ExpenseEntriesCell
                        entries={row.expenseEntries}
                        showAllNotes={showAllNotes}
                        formatNum={formatNum}
                        parseNum={parseNum}
                        onChange={(expenseEntries) =>
                          setExpenseEntries(row.id, expenseEntries)
                        }
                        onAmountContextMenu={(e, entryId) =>
                          openContextMenu(e, row.id, "expenses", {
                            expenseEntryId: entryId,
                          })
                        }
                        onEditEntryNote={(entryId) => {
                          const entry = row.expenseEntries.find(
                            (e) => e.id === entryId,
                          );
                          setNoteEditor({
                            rowId: row.id,
                            noteKey: "expenses",
                            expenseEntryId: entryId,
                            initialText: entry?.note ?? "",
                          });
                        }}
                        onRowContextMenu={(e) =>
                          openRowContextMenu(e, row.id)
                        }
                      />
                    </>
                  )}
                  <td
                    className="ledger-td computed font-medium text-emerald-900"
                    onContextMenu={(e) => openRowContextMenu(e, row.id)}
                  >
                    {isLedgerRowActive(row)
                      ? formatNum(row.dailyBalance) || "0"
                      : "0"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="ledger-tfoot-row font-semibold text-slate-900">
                <td className="ledger-td ledger-tfoot-cell ledger-sticky-col sticky left-0 z-10">
                  總計
                </td>
                <td className="ledger-td ledger-tfoot-cell ledger-tfoot-num">
                  {formatNum(totals.fuel)}
                </td>
                <td className="ledger-td ledger-tfoot-cell ledger-tfoot-num">
                  {formatNum(totals.water)}
                </td>
                <td className="ledger-td ledger-tfoot-cell ledger-tfoot-num">
                  {formatNum(totals.urea)}
                </td>
                <td className="ledger-td ledger-tfoot-cell ledger-tfoot-num ledger-tfoot-accent">
                  {formatNum(totals.productSubtotal)}
                </td>
                {isMobileSpreadsheet ? (
                  <td className="ledger-td ledger-tfoot-cell align-top">
                    <p className="ledger-tfoot-section-title">轉數快小計</p>
                    <FpsTotalsFooter totals={totals} formatNum={formatNum} />
                    <p className="ledger-tfoot-section-title mt-2 border-t border-slate-300/70 pt-2">
                      出帳小計
                    </p>
                    <div className="ledger-outflow-totals">
                      {(
                        [
                          ["已入銀行", totals.bankDeposited],
                          ["待入銀行", totals.bankPending],
                          ["撤單", totals.cancelled],
                          ["其他支出", totals.expenses],
                        ] as const
                      ).map(([label, value]) => (
                        <div key={label} className="ledger-outflow-totals-row">
                          <span className="font-semibold text-slate-600">
                            {label}
                          </span>
                          <span className="tabular-nums font-bold text-slate-900">
                            {formatNum(value) || "0"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                ) : (
                  <>
                    <td
                      colSpan={2}
                      className="ledger-td ledger-tfoot-cell ledger-tfoot-fps align-top"
                    >
                      <FpsTotalsFooter
                        totals={totals}
                        formatNum={formatNum}
                      />
                    </td>
                    <td className="ledger-td ledger-tfoot-cell ledger-tfoot-num">
                      {formatNum(totals.bankDeposited)}
                    </td>
                    <td className="ledger-td ledger-tfoot-cell ledger-tfoot-num">
                      {formatNum(totals.bankPending)}
                    </td>
                    <td className="ledger-td ledger-tfoot-cell ledger-tfoot-num">
                      {formatNum(totals.cancelled)}
                    </td>
                    <td className="ledger-td ledger-tfoot-cell ledger-tfoot-num">
                      {formatNum(totals.expenses)}
                    </td>
                  </>
                )}
                <td className="ledger-td ledger-tfoot-cell ledger-tfoot-num ledger-tfoot-accent text-emerald-900">
                  {formatNum(totals.closingBalance)}
                </td>
              </tr>
              <tr className="bg-emerald-50 text-xs text-slate-600">
                <td
                  colSpan={isMobileSpreadsheet ? 7 : 12}
                  className="px-3 py-2"
                >
                  {isMobileSpreadsheet
                    ? "支出明細含轉數快、銀行、撤單、其他支出；撤單自總收入扣除，其餘扣尾數。"
                    : "右鍵：備註、列操作、WhatsApp／微信匯出 · 當日尾數＝當日淨收入−出帳（非累計）；未填列顯示 0；上方期末尾數為整月累計"}
                </td>
              </tr>
            </tfoot>
          </table>
          </div>
          </div>
        </div>
      </div>

      <div
        className={
          isWorkbench
            ? "sticky bottom-0 z-30 shrink-0 border-t border-emerald-200/80 bg-white/95 px-3 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm lg:hidden"
            : "sticky bottom-0 z-30 shrink-0 border-t border-emerald-200/80 bg-white/95 px-3 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:hidden"
        }
      >
        <p className="mb-2 text-center text-[11px] leading-snug text-slate-600">
          欄位一改即存本機；備份到 Supabase 資料庫請按：
        </p>
        {saveSupabaseControl}
      </div>

      <LedgerNoteContextMenu
        menu={contextMenu}
        hasNote={Boolean(contextNoteText.trim())}
        onClose={() => setContextMenu(null)}
        onEdit={() => {
          if (!contextMenu?.noteKey || !isLedgerNoteKey(contextMenu.noteKey)) {
            return;
          }
          setNoteEditor({
            rowId: contextMenu.rowId,
            noteKey: contextMenu.noteKey,
            fpsEntryId: contextMenu.fpsEntryId,
            expenseEntryId: contextMenu.expenseEntryId,
            initialText: contextNoteText,
          });
        }}
        onClearNote={() => {
          if (!contextMenu?.noteKey || !isLedgerNoteKey(contextMenu.noteKey)) {
            return;
          }
          updateNote(
            contextMenu.rowId,
            contextMenu.noteKey,
            "",
            {
              fpsEntryId: contextMenu.fpsEntryId,
              expenseEntryId: contextMenu.expenseEntryId,
            },
          );
        }}
        onInsertRow={() => {
          if (!contextMenu) return;
          insertRowAfter(contextMenu.rowId);
        }}
        onRemoveRow={() => {
          if (!contextMenu) return;
          removeRow(contextMenu.rowId);
        }}
        onClearRow={() => {
          if (!contextMenu) return;
          clearRow(contextMenu.rowId);
        }}
        onWhatsAppRow={() => {
          if (!contextMenu) return;
          const row = computed.find((r) => r.id === contextMenu.rowId);
          if (!row) return;
          void (async () => {
            const saved = await persistBeforeShare();
            if (!saved.ok) {
              alert(saved.error);
              return;
            }
            const result = openWhatsAppShare(
              formatLedgerRowForWhatsApp(
                row,
                readLocalCompanyName() ?? "我的公司",
              ),
            );
            if (!result.ok && result.error) alert(result.error);
          })();
        }}
        onWhatsAppMonth={() => {
          void (async () => {
            const saved = await persistBeforeShare();
            if (!saved.ok) {
              alert(saved.error);
              return;
            }
            const result = openWhatsAppShare(
              formatLedgerMonthForWhatsApp(
                computed,
                totals,
                year,
                month,
                readLocalCompanyName() ?? "我的公司",
              ),
            );
            if (!result.ok && result.error) alert(result.error);
          })();
        }}
        onWeChatRow={() => {
          if (!contextMenu) return;
          const row = computed.find((r) => r.id === contextMenu.rowId);
          if (!row) return;
          void (async () => {
            const saved = await persistBeforeShare();
            if (!saved.ok) {
              alert(saved.error);
              return;
            }
            const result = await shareViaWeChat(
              formatLedgerRowForWhatsApp(
                row,
                readLocalCompanyName() ?? "我的公司",
              ),
            );
            if (!result.ok && result.error) alert(result.error);
            else alert(weChatShareSuccessMessage(result.mode));
          })();
        }}
        onWeChatMonth={() => {
          void (async () => {
            const saved = await persistBeforeShare();
            if (!saved.ok) {
              alert(saved.error);
              return;
            }
            const result = await shareViaWeChat(
              formatLedgerMonthForWhatsApp(
                computed,
                totals,
                year,
                month,
                readLocalCompanyName() ?? "我的公司",
              ),
            );
            if (!result.ok && result.error) alert(result.error);
            else alert(weChatShareSuccessMessage(result.mode));
          })();
        }}
      />

      <LedgerNoteEditor
        open={Boolean(noteEditor)}
        initialText={noteEditor?.initialText ?? ""}
        onClose={() => setNoteEditor(null)}
        onSave={(text) => {
          if (!noteEditor) return;
          updateNote(
            noteEditor.rowId,
            noteEditor.noteKey,
            text,
            {
              fpsEntryId: noteEditor.fpsEntryId,
              expenseEntryId: noteEditor.expenseEntryId,
            },
          );
          setNoteEditor(null);
        }}
      />
    </div>
  );
}

function ExpenseEntriesCell({
  entries,
  showAllNotes,
  formatNum,
  parseNum,
  onChange,
  onAmountContextMenu,
  onEditEntryNote,
  onRowContextMenu,
}: {
  entries: ExpenseEntry[];
  showAllNotes: boolean;
  formatNum: (n: number) => string;
  parseNum: (raw: string) => number;
  onChange: (entries: ExpenseEntry[]) => void;
  onAmountContextMenu: (e: React.MouseEvent, entryId: string) => void;
  onEditEntryNote: (entryId: string) => void;
  onRowContextMenu: (e: React.MouseEvent) => void;
}) {
  const updateEntry = (id: string, patch: Partial<ExpenseEntry>) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeEntry = (id: string) => {
    onChange(entries.filter((e) => e.id !== id));
  };

  const addEntry = () => {
    onChange([...entries, createEmptyExpenseEntry()]);
  };

  return (
    <td className="ledger-td align-top" onContextMenu={onRowContextMenu}>
      <div className="flex min-w-[10rem] flex-col gap-1.5 py-0.5">
        {entries.length === 0 ? (
          <p className="text-xs text-slate-400">尚無支出</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-1">
              <input
                type="text"
                value={entry.label}
                onChange={(e) =>
                  updateEntry(entry.id, { label: e.target.value })
                }
                placeholder="項目"
                className="ledger-input min-w-0 flex-1 text-sm"
              />
              <div className="min-w-[5.5rem] flex-1">
                <NotableAmountCell
                  variant="inline"
                  noteKey="expenses"
                  note={entry.note}
                  showAllNotes={showAllNotes}
                  value={entry.amount}
                  placeholder="0"
                  formatNum={formatNum}
                  parseNum={parseNum}
                  onValueChange={(amount) => updateEntry(entry.id, { amount })}
                  onContextMenu={(e) => onAmountContextMenu(e, entry.id)}
                  onEditNote={() => onEditEntryNote(entry.id)}
                />
              </div>
              <button
                type="button"
                className="mt-1 shrink-0 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100"
                title="移除此筆支出"
                onClick={() => removeEntry(entry.id)}
              >
                ×
              </button>
            </div>
          ))
        )}
        <button
          type="button"
          className="self-start rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
          onClick={addEntry}
        >
          ＋ 支出
        </button>
      </div>
    </td>
  );
}

function FpsEntriesCell({
  entries,
  showAllNotes,
  formatNum,
  parseNum,
  onChange,
  onAmountContextMenu,
  onEditEntryNote,
  onRowContextMenu,
}: {
  entries: FpsEntry[];
  showAllNotes: boolean;
  formatNum: (n: number) => string;
  parseNum: (raw: string) => number;
  onChange: (entries: FpsEntry[]) => void;
  onAmountContextMenu: (e: React.MouseEvent, entryId: string) => void;
  onEditEntryNote: (entryId: string) => void;
  onRowContextMenu: (e: React.MouseEvent) => void;
}) {
  const updateEntry = (id: string, patch: Partial<FpsEntry>) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeEntry = (id: string) => {
    onChange(entries.filter((e) => e.id !== id));
  };

  const addEntry = () => {
    onChange([...entries, createEmptyFpsEntry()]);
  };

  return (
    <td
      className="ledger-td align-top"
      colSpan={2}
      onContextMenu={onRowContextMenu}
    >
      <div className="flex min-w-[14rem] flex-col gap-1.5 py-0.5">
        {entries.length === 0 ? (
          <p className="text-xs text-slate-400">尚無轉數快</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-1">
              <select
                value={entry.channel}
                onChange={(e) =>
                  updateEntry(entry.id, {
                    channel: e.target.value as FpsChannel,
                  })
                }
                className="ledger-input min-w-0 flex-1 cursor-pointer text-sm"
              >
                {FPS_CHANNEL_OPTIONS.map((opt) => (
                  <option key={opt.value || "empty"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="min-w-[5.5rem] flex-1">
                <NotableAmountCell
                  variant="inline"
                  noteKey="fpsAmount"
                  note={entry.note}
                  showAllNotes={showAllNotes}
                  value={entry.amount}
                  disabled={!entry.channel}
                  placeholder={entry.channel ? "0" : "先選方式"}
                  formatNum={formatNum}
                  parseNum={parseNum}
                  onValueChange={(amount) => updateEntry(entry.id, { amount })}
                  onContextMenu={(e) => onAmountContextMenu(e, entry.id)}
                  onEditNote={() => onEditEntryNote(entry.id)}
                />
              </div>
              <button
                type="button"
                className="mt-1 shrink-0 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100"
                title="移除此筆轉數快"
                onClick={() => removeEntry(entry.id)}
              >
                ×
              </button>
            </div>
          ))
        )}
        <button
          type="button"
          className="self-start rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
          onClick={addEntry}
        >
          ＋ 轉數快
        </button>
      </div>
    </td>
  );
}

const FPS_TOTAL_LINES = [
  { key: "company", label: "公司" },
  { key: "private", label: "私人" },
  { key: "alipay", label: "Alipay" },
] as const;

function fpsTotalAmount(
  totals: DailyLedgerTotals,
  key: (typeof FPS_TOTAL_LINES)[number]["key"],
): number {
  if (key === "company") return totals.fpsCompany;
  if (key === "private") return totals.fpsPrivate;
  return totals.fpsAlipay;
}

function FpsTotalsFooter({
  totals,
  formatNum,
}: {
  totals: DailyLedgerTotals;
  formatNum: (n: number) => string;
}) {
  return (
    <div className="ledger-fps-total-entry-wrap">
      {FPS_TOTAL_LINES.map(({ key, label }) => (
        <div key={key} className="ledger-fps-total-entry-line">
          <span className="ledger-fps-total-entry-channel">{label}</span>
          <span className="ledger-fps-total-entry-amount">
            {formatNum(fpsTotalAmount(totals, key)) || "0"}
          </span>
        </div>
      ))}
    </div>
  );
}

function SummaryChip({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex min-h-[4.5rem] flex-col justify-center rounded-xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-sm ${
        highlight ? "border-l-4 border-l-emerald-600 pl-3" : ""
      }`}
    >
      <p className="text-[11px] font-medium leading-tight text-slate-500 sm:text-xs">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums sm:text-xl ${
          highlight ? "text-emerald-900" : "text-slate-900"
        }`}
      >
        {value.toLocaleString("zh-TW", {
          style: "currency",
          currency: "TWD",
          maximumFractionDigits: 0,
        })}
      </p>
    </div>
  );
}
