"use client";

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
import { LogoutButton } from "@/components/layout/LogoutButton";
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
    if (!row || !contextMenu.noteKey) return "";
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
        ? "寫入 Supabase…"
        : syncStatus === "synced"
          ? "已寫入 Supabase"
          : syncStatus === "cloud_pending"
            ? "已存本機 · Supabase 尚未更新"
            : syncStatus === "local_saved"
              ? "已存本機（需手動存 Supabase）"
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

  function exportCsv() {
    const csv = buildMonthCsv(key, sortRowsByDate(rows), computed);
    downloadTextFile(`日結-${key}.csv`, csv, "text/csv;charset=utf-8");
  }

  if (!ready && rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        載入日結表…
      </div>
    );
  }

  return (
    <div className="ledger-workspace flex min-h-0 flex-1 flex-col">
      <header className="ledger-hero rounded-b-2xl px-3 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="ledger-hero-kicker text-[10px] font-bold uppercase tracking-[0.25em] sm:text-xs">
              Daily Ledger
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {year} 年 {month} 月
            </h1>
            <p className="mt-0.5 text-sm font-medium text-slate-600">
              營收對帳表
            </p>
            <p className="mt-1 max-w-2xl text-xs text-slate-600 sm:text-sm">
              <span className="lg:hidden">
                手機／平板：每列「列操作」或「＋備註」；電腦可右鍵操作。
              </span>
              <span className="hidden lg:inline">
                右鍵可新增／移除列、備註與清空該列；轉數快／支出每筆金額旁可按「＋備註」。
              </span>
              {organizationId ? (
                <span className="mt-1 block text-[var(--theme-accent-strong)]">
                  不會自動連 Supabase；編輯只存本機，要備份到資料庫請按「儲存至 Supabase」。
                </span>
              ) : null}
            </p>
            {syncLabel ? (
              <p className="mt-2 text-xs font-medium text-[var(--theme-accent-strong)]">
                {syncLabel}
                {syncMessage ? ` · ${syncMessage}` : null}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {organizationId ? (
              <button
                type="button"
                onClick={() => void handleSaveToCloud()}
                disabled={isSavingCloud}
                className={`ledger-touch-btn rounded-full px-4 py-2.5 text-sm font-medium shadow-sm sm:py-2 ${
                  cloudDirty ? "ledger-btn-primary" : "ledger-btn-ghost"
                }`}
              >
                {isSavingCloud ? "寫入中…" : "儲存至 Supabase"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={exportCsv}
              className="ledger-touch-btn ledger-btn-ghost rounded-full px-4 py-2.5 text-sm font-medium shadow-sm sm:py-2"
            >
              匯出 CSV
            </button>
            <button
              type="button"
              onClick={() => setShowAllNotes((v) => !v)}
              className={`ledger-touch-btn rounded-full px-4 py-2.5 text-sm font-medium shadow-sm transition sm:py-2 ${
                showAllNotes
                  ? "border border-amber-300/80 bg-amber-50 text-amber-900"
                  : "ledger-btn-ghost"
              }`}
            >
              {showAllNotes ? "隱藏備註" : "顯示備註"}
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="ledger-touch-btn ledger-btn-ghost rounded-full px-4 py-2.5 text-sm font-medium shadow-sm sm:py-2"
            >
              ← 上個月
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="ledger-touch-btn ledger-btn-ghost rounded-full px-4 py-2.5 text-sm font-medium shadow-sm sm:py-2"
            >
              下個月 →
            </button>
            <LogoutButton
              label="登出"
              className="ledger-touch-btn ledger-btn-primary rounded-full px-4 py-2.5 text-sm font-medium shadow-sm sm:py-2"
            />
          </div>
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

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryChip label="總收入" value={totals.totalRevenue} accent />
          <SummaryChip label="總支出" value={totals.expenses} />
          <SummaryChip label="待入銀行合計" value={totals.bankPending} />
          <SummaryChip label="期末尾數" value={totals.closingBalance} accent />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
        <div className="lg:hidden">
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

        <div className="hidden lg:block">
          <p className="mb-2 text-center text-xs text-slate-500 xl:hidden">
            ← 左右滑動可查看更多欄位 →
          </p>
          <div className="ledger-table-scroll ledger-table-shell overflow-x-auto overscroll-x-contain rounded-2xl bg-white">
          <div className="inline-block min-w-full align-top">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="ledger-thead-row-main">
                <th rowSpan={2} className="ledger-th ledger-sticky-col sticky left-0 z-20 min-w-[7.5rem]">
                  日期
                </th>
                <th colSpan={3} className="ledger-th">
                  收入明細
                </th>
                <th rowSpan={2} className="ledger-th ledger-th-accent min-w-[5.5rem]">
                  品項小計
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
                <th rowSpan={2} className="ledger-th ledger-th-accent min-w-[5.5rem]">
                  尾數
                </th>
              </tr>
              <tr className="ledger-thead-row-sub">
                <th className="ledger-th-sub">油</th>
                <th className="ledger-th-sub">水</th>
                <th className="ledger-th-sub">尿素</th>
                <th className="ledger-th-sub min-w-[7.5rem]">收款方式</th>
                <th className="ledger-th-sub min-w-[5.5rem]">金額</th>
              </tr>
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
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) =>
                        updateRow(row.id, { date: e.target.value })
                      }
                      className="ledger-input w-full min-w-[7rem] text-left"
                    />
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
                      const entry = row.fpsEntries.find((e) => e.id === entryId);
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
                      onValueChange={(v) => updateRow(row.id, { [field]: v })}
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
                    onRowContextMenu={(e) => openRowContextMenu(e, row.id)}
                  />
                  <td
                    className="ledger-td computed font-medium text-emerald-900"
                    onContextMenu={(e) => openRowContextMenu(e, row.id)}
                  >
                    {isLedgerRowActive(row)
                      ? formatNum(row.balance)
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-semibold text-slate-900">
                <td className="ledger-td ledger-sticky-col sticky left-0 z-10 bg-slate-100">總計</td>
                <td className="ledger-td text-right tabular-nums">
                  {formatNum(totals.fuel)}
                </td>
                <td className="ledger-td text-right tabular-nums">
                  {formatNum(totals.water)}
                </td>
                <td className="ledger-td text-right tabular-nums">
                  {formatNum(totals.urea)}
                </td>
                <td className="ledger-td text-right tabular-nums">
                  {formatNum(totals.productSubtotal)}
                </td>
                <td className="ledger-td text-right tabular-nums" colSpan={2}>
                  公司 {formatNum(totals.fpsCompany)} · 私人{" "}
                  {formatNum(totals.fpsPrivate)} · Alipay{" "}
                  {formatNum(totals.fpsAlipay)}
                </td>
                <td className="ledger-td text-right tabular-nums">
                  {formatNum(totals.bankDeposited)}
                </td>
                <td className="ledger-td text-right tabular-nums">
                  {formatNum(totals.bankPending)}
                </td>
                <td className="ledger-td text-right tabular-nums">
                  {formatNum(totals.cancelled)}
                </td>
                <td className="ledger-td text-right tabular-nums align-top">
                  {formatNum(totals.expenses)}
                </td>
                <td className="ledger-td text-right tabular-nums text-emerald-800">
                  {formatNum(totals.closingBalance)}
                </td>
              </tr>
              <tr className="bg-emerald-50 text-xs text-slate-600">
                <td colSpan={12} className="px-3 py-2">
                  右鍵：備註、列操作、WhatsApp／微信匯出 ·
                  尾數＝前日結存＋當日收支（僅在有填資料的列顯示；未填列仍沿用前日結存計算下一列）
                </td>
              </tr>
            </tfoot>
          </table>
          </div>
          </div>
        </div>
      </div>

      <LedgerNoteContextMenu
        menu={contextMenu}
        hasNote={Boolean(contextNoteText.trim())}
        onClose={() => setContextMenu(null)}
        onEdit={() => {
          if (!contextMenu?.noteKey) return;
          setNoteEditor({
            rowId: contextMenu.rowId,
            noteKey: contextMenu.noteKey,
            fpsEntryId: contextMenu.fpsEntryId,
            expenseEntryId: contextMenu.expenseEntryId,
            initialText: contextNoteText,
          });
        }}
        onClearNote={() => {
          if (!contextMenu?.noteKey) return;
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
            else {
              const msg = weChatShareSuccessMessage(result.mode);
              if (msg) alert(msg);
            }
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
            else {
              const msg = weChatShareSuccessMessage(result.mode);
              if (msg) alert(msg);
            }
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

function SummaryChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 shadow-sm backdrop-blur-sm ${
        accent
          ? "ledger-stat-accent"
          : "border-white/60 bg-white/70"
      }`}
    >
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p
        className={`ledger-stat-value mt-1 text-xl font-semibold tabular-nums ${
          accent ? "" : "text-slate-900"
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
