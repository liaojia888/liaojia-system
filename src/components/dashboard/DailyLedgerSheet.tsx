"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LEDGER_STORAGE_KEY,
  computeRows,
  computeTotals,
  createEmptyRow,
  defaultRowsForMonth,
  normalizeRow,
  sortRowsByDate,
  FPS_CHANNEL_OPTIONS,
  isLedgerRowActive,
  type DailyLedgerRow,
  type FpsChannel,
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
} from "@/lib/whatsapp-export";

function formatNum(n: number): string {
  if (!n) return "";
  return n.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

function parseNum(raw: string): number {
  const v = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(v) ? v : 0;
}

type StoredLedger = {
  monthKey: string;
  rows: DailyLedgerRow[];
};

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function loadStored(month: string): DailyLedgerRow[] | null {
  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, StoredLedger>;
    const rows = all[month]?.rows;
    return rows?.map((r) => normalizeRow(r as Record<string, unknown>)) ?? null;
  } catch {
    return null;
  }
}

function saveStored(month: string, rows: DailyLedgerRow[]) {
  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, StoredLedger>) : {};
    all[month] = { monthKey: month, rows };
    localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore quota errors
  }
}

const REVENUE_FIELDS = ["fuel", "water", "urea"] as const;
const OTHER_PAYMENT_FIELDS = [
  "bankDeposited",
  "bankPending",
  "cancelled",
  "expenses",
] as const;

export function DailyLedgerSheet() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<DailyLedgerRow[]>([]);
  const [ready, setReady] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [noteEditor, setNoteEditor] = useState<
    (NoteTarget & { initialText: string }) | null
  >(null);

  const key = monthKey(year, month);

  useEffect(() => {
    const stored = loadStored(key);
    if (stored?.length) {
      setRows(sortRowsByDate(stored));
    } else {
      setRows(defaultRowsForMonth(year, month));
    }
    setReady(true);
  }, [key, year, month]);

  useEffect(() => {
    if (!ready || rows.length === 0) return;
    saveStored(key, rows);
  }, [rows, key, ready]);

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
    (rowId: string, noteKey: LedgerNoteKey, text: string) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const notes: LedgerNotes = { ...row.notes };
          const trimmed = text.trim();
          if (trimmed) notes[noteKey] = trimmed;
          else delete notes[noteKey];
          return { ...row, notes };
        }),
      );
    },
    [],
  );

  const openContextMenu = useCallback(
    (e: React.MouseEvent, rowId: string, noteKey: LedgerNoteKey) => {
      e.preventDefault();
      setContextMenu({
        rowId,
        noteKey,
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
    return getNote(row, contextMenu.noteKey) ?? "";
  }, [contextMenu, rows, getNote]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setReady(false);
  };

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        載入日結表…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f3f6fb]">
      <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              日結工作台
            </p>
            <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
              {year} 年 {month} 月 · 營收對帳表
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              右鍵可新增／移除列、備註與清空該列；備註顯示在格內右上角。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAllNotes((v) => !v)}
              className={`rounded-lg border px-3 py-2 text-sm ${
                showAllNotes
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-slate-300 bg-white hover:bg-slate-50"
              }`}
            >
              {showAllNotes ? "隱藏全部備註" : "全部顯示備註"}
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              上個月
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              下個月
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryChip label="總收入" value={totals.totalRevenue} accent />
          <SummaryChip label="總支出" value={totals.expenses} />
          <SummaryChip label="待入銀行合計" value={totals.bankPending} />
          <SummaryChip label="期末尾數" value={totals.closingBalance} accent />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-3 md:p-4">
        <div className="inline-block min-w-full align-top rounded-lg border border-slate-300 bg-white shadow-sm">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#217346] text-white">
                <th rowSpan={2} className="ledger-th sticky left-0 z-20 min-w-[7.5rem]">
                  日期
                </th>
                <th colSpan={3} className="ledger-th">
                  收入明細
                </th>
                <th rowSpan={2} className="ledger-th min-w-[5.5rem] bg-[#1a5c38]">
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
                <th rowSpan={2} className="ledger-th">
                  支出
                </th>
                <th rowSpan={2} className="ledger-th min-w-[5.5rem] bg-[#1a5c38]">
                  尾數
                </th>
              </tr>
              <tr className="bg-[#1e6b41] text-white">
                <th className="ledger-th-sub">油</th>
                <th className="ledger-th-sub">水</th>
                <th className="ledger-th-sub">尿素</th>
                <th className="ledger-th-sub min-w-[7.5rem]">收款方式</th>
                <th className="ledger-th-sub min-w-[5.5rem]">金額</th>
              </tr>
            </thead>
            <tbody>
              {computed.map((row) => (
                <tr key={row.id} className="group hover:bg-emerald-50/40">
                  <td
                    className="ledger-td sticky left-0 z-10 bg-white group-hover:bg-emerald-50/40"
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
                  <FpsCell
                    channel={row.fpsChannel}
                    amount={row.fpsAmount}
                    amountNote={getNote(row, "fpsAmount")}
                    showAllNotes={showAllNotes}
                    formatNum={formatNum}
                    parseNum={parseNum}
                    onChannelChange={(fpsChannel) =>
                      updateRow(row.id, { fpsChannel })
                    }
                    onAmountChange={(fpsAmount) =>
                      updateRow(row.id, { fpsAmount })
                    }
                    onAmountContextMenu={(e) =>
                      openContextMenu(e, row.id, "fpsAmount")
                    }
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
                <td className="ledger-td sticky left-0 z-10 bg-slate-100">總計</td>
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
                <td className="ledger-td text-right tabular-nums">
                  {formatNum(totals.expenses)}
                </td>
                <td className="ledger-td text-right tabular-nums text-emerald-800">
                  {formatNum(totals.closingBalance)}
                </td>
              </tr>
              <tr className="bg-emerald-50 text-xs text-slate-600">
                <td colSpan={12} className="px-3 py-2">
                  右鍵：備註、列操作、WhatsApp 匯出 ·
                  尾數＝前日結存＋當日收支（僅在有填資料的列顯示；未填列仍沿用前日結存計算下一列）
                </td>
              </tr>
            </tfoot>
          </table>
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
            initialText: contextNoteText,
          });
        }}
        onClearNote={() => {
          if (!contextMenu?.noteKey) return;
          updateNote(contextMenu.rowId, contextMenu.noteKey, "");
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
          const result = openWhatsAppShare(
            formatLedgerRowForWhatsApp(
              row,
              readLocalCompanyName() ?? "我的公司",
            ),
          );
          if (!result.ok && result.error) alert(result.error);
        }}
        onWhatsAppMonth={() => {
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
        }}
      />

      <LedgerNoteEditor
        open={Boolean(noteEditor)}
        initialText={noteEditor?.initialText ?? ""}
        onClose={() => setNoteEditor(null)}
        onSave={(text) => {
          if (!noteEditor) return;
          updateNote(noteEditor.rowId, noteEditor.noteKey, text);
          setNoteEditor(null);
        }}
      />
    </div>
  );
}

function FpsCell({
  channel,
  amount,
  amountNote,
  showAllNotes,
  formatNum,
  parseNum,
  onChannelChange,
  onAmountChange,
  onAmountContextMenu,
  onRowContextMenu,
}: {
  channel: FpsChannel;
  amount: number;
  amountNote?: string;
  showAllNotes: boolean;
  formatNum: (n: number) => string;
  parseNum: (raw: string) => number;
  onChannelChange: (channel: FpsChannel) => void;
  onAmountChange: (amount: number) => void;
  onAmountContextMenu: (e: React.MouseEvent) => void;
  onRowContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <>
      <td className="ledger-td" onContextMenu={onRowContextMenu}>
        <select
          value={channel}
          onChange={(e) => onChannelChange(e.target.value as FpsChannel)}
          className="ledger-input w-full min-w-[7rem] cursor-pointer text-sm"
        >
          {FPS_CHANNEL_OPTIONS.map((opt) => (
            <option key={opt.value || "empty"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </td>
      <NotableAmountCell
        noteKey="fpsAmount"
        note={amountNote}
        showAllNotes={showAllNotes}
        value={amount}
        disabled={!channel}
        placeholder={channel ? "0" : "先選方式"}
        formatNum={formatNum}
        parseNum={parseNum}
        onValueChange={onAmountChange}
        onContextMenu={(e) => onAmountContextMenu(e)}
      />
    </>
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
      className={`rounded-xl border px-4 py-3 ${
        accent
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-xs text-slate-600">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${
          accent ? "text-emerald-900" : "text-slate-900"
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
