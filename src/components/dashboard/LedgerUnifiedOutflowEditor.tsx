"use client";

import { useState } from "react";
import {
  FPS_CHANNEL_OPTIONS,
  createEmptyExpenseEntry,
  createEmptyFpsEntry,
  totalRowCashOutflow,
  type DailyLedgerRow,
  type ExpenseEntry,
  type FpsChannel,
  type FpsEntry,
  type LedgerNoteKey,
} from "@/lib/daily-ledger";
import { NotableAmountCell } from "@/components/dashboard/NotableAmountCell";

type OutflowKind =
  | "bankDeposited"
  | "bankPending"
  | "cancelled"
  | "fps"
  | "expense";

type OutflowLine =
  | { key: string; kind: "bankDeposited" | "bankPending" | "cancelled" }
  | { key: string; kind: "fps"; entryId: string }
  | { key: string; kind: "expense"; entryId: string };

const TYPE_OPTIONS: { value: OutflowKind; label: string }[] = [
  { value: "fps", label: "轉數快（FPS）" },
  { value: "bankDeposited", label: "已入銀行（公司）" },
  { value: "bankPending", label: "待入銀行（公司）" },
  { value: "cancelled", label: "撤單（自總收入扣）" },
  { value: "expense", label: "其他支出" },
];

const ADD_OPTIONS: { value: "" | "fps" | "expense"; label: string }[] = [
  { value: "", label: "＋ 從清單選擇要新增的項目…" },
  { value: "fps", label: "轉數快（FPS）" },
  { value: "expense", label: "其他支出" },
];

function buildLines(row: DailyLedgerRow): OutflowLine[] {
  const lines: OutflowLine[] = [
    { key: "bankDeposited", kind: "bankDeposited" },
    { key: "bankPending", kind: "bankPending" },
    { key: "cancelled", kind: "cancelled" },
  ];
  for (const e of row.fpsEntries) {
    lines.push({ key: `fps-${e.id}`, kind: "fps", entryId: e.id });
  }
  for (const e of row.expenseEntries) {
    lines.push({ key: `expense-${e.id}`, kind: "expense", entryId: e.id });
  }
  return lines;
}

function bankNoteKey(kind: "bankDeposited" | "bankPending" | "cancelled"): LedgerNoteKey {
  return kind;
}

function lineAmount(line: OutflowLine, row: DailyLedgerRow): number {
  if (line.kind === "fps") {
    return row.fpsEntries.find((e) => e.id === line.entryId)?.amount ?? 0;
  }
  if (line.kind === "expense") {
    return row.expenseEntries.find((e) => e.id === line.entryId)?.amount ?? 0;
  }
  return row[line.kind];
}

/** 第三種介面：支出明細以「類型下拉 ＋ 細項 ＋ 金額」列呈現 */
export function LedgerUnifiedOutflowEditor({
  row,
  showAllNotes,
  formatNum,
  parseNum,
  getNote,
  onPatch,
  onFpsChange,
  onExpenseChange,
  onAmountContextMenu,
  onEditFpsNote,
  onEditExpenseNote,
  onBankContextMenu,
  onEditBankNote,
}: {
  row: DailyLedgerRow;
  showAllNotes: boolean;
  formatNum: (n: number) => string;
  parseNum: (raw: string) => number;
  getNote: (row: DailyLedgerRow, noteKey: LedgerNoteKey) => string | undefined;
  onPatch: (patch: Partial<DailyLedgerRow>) => void;
  onFpsChange: (entries: FpsEntry[]) => void;
  onExpenseChange: (entries: ExpenseEntry[]) => void;
  onAmountContextMenu: (
    e: React.MouseEvent,
    target:
      | { kind: "fps"; entryId: string }
      | { kind: "expense"; entryId: string },
  ) => void;
  onEditFpsNote: (entryId: string) => void;
  onEditExpenseNote: (entryId: string) => void;
  onBankContextMenu: (
    e: React.MouseEvent,
    noteKey: LedgerNoteKey,
  ) => void;
  onEditBankNote: (noteKey: LedgerNoteKey) => void;
}) {
  const [addPick, setAddPick] = useState("");
  const cashOut = totalRowCashOutflow(row);
  const lines = buildLines(row);

  const updateFps = (id: string, patch: Partial<FpsEntry>) => {
    onFpsChange(
      row.fpsEntries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  };

  const updateExpense = (id: string, patch: Partial<ExpenseEntry>) => {
    onExpenseChange(
      row.expenseEntries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  };

  function removeLine(line: OutflowLine) {
    if (line.kind === "fps") {
      onFpsChange(row.fpsEntries.filter((e) => e.id !== line.entryId));
    } else if (line.kind === "expense") {
      onExpenseChange(
        row.expenseEntries.filter((e) => e.id !== line.entryId),
      );
    } else {
      onPatch({ [line.kind]: 0 });
    }
  }

  function addFromDropdown(kind: "fps" | "expense") {
    if (kind === "fps") {
      onFpsChange([...row.fpsEntries, createEmptyFpsEntry()]);
    } else {
      onExpenseChange([...row.expenseEntries, createEmptyExpenseEntry()]);
    }
  }

  function changeLineType(line: OutflowLine, newKind: OutflowKind) {
    if (line.kind === newKind) return;
    const amount = lineAmount(line, row);

    if (line.kind === "fps") {
      const entry = row.fpsEntries.find((e) => e.id === line.entryId);
      onFpsChange(row.fpsEntries.filter((e) => e.id !== line.entryId));
      if (newKind === "expense") {
        onExpenseChange([
          ...row.expenseEntries,
          { ...createEmptyExpenseEntry(), amount, label: entry?.note?.trim() ?? "" },
        ]);
      } else if (newKind !== "fps") {
        onPatch({ [newKind]: amount });
      }
      return;
    }

    if (line.kind === "expense") {
      const entry = row.expenseEntries.find((e) => e.id === line.entryId);
      onExpenseChange(
        row.expenseEntries.filter((e) => e.id !== line.entryId),
      );
      if (newKind === "fps") {
        onFpsChange([
          ...row.fpsEntries,
          {
            ...createEmptyFpsEntry(),
            amount,
            note: entry?.label?.trim() ?? entry?.note ?? "",
          },
        ]);
      } else if (newKind !== "expense") {
        onPatch({ [newKind]: amount });
      }
      return;
    }

    const fromBank = line.kind;
    onPatch({ [fromBank]: 0 });
    if (newKind === "fps") {
      onFpsChange([...row.fpsEntries, { ...createEmptyFpsEntry(), amount }]);
    } else if (newKind === "expense") {
      onExpenseChange([
        ...row.expenseEntries,
        { ...createEmptyExpenseEntry(), amount },
      ]);
    } else if (newKind !== fromBank) {
      onPatch({ [newKind]: row[newKind] + amount });
    }
  }

  return (
    <div
      className="ledger-unified-outflow relative z-10 flex min-w-[17rem] max-w-[28rem] flex-col gap-2 py-0.5"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="grid grid-cols-[minmax(6.5rem,7.5rem)_minmax(0,1fr)_5.25rem_1.5rem] gap-1 px-0.5 text-[10px] font-semibold text-slate-500"
        aria-hidden
      >
        <span>類型</span>
        <span>細項</span>
        <span className="text-right">金額</span>
        <span />
      </div>

      <div className="flex flex-col gap-1.5">
        {lines.map((line) => (
          <OutflowLineRow
            key={line.key}
            line={line}
            row={row}
            showAllNotes={showAllNotes}
            formatNum={formatNum}
            parseNum={parseNum}
            getNote={getNote}
            onPatch={onPatch}
            updateFps={updateFps}
            updateExpense={updateExpense}
            onAmountContextMenu={onAmountContextMenu}
            onEditFpsNote={onEditFpsNote}
            onEditExpenseNote={onEditExpenseNote}
            onBankContextMenu={onBankContextMenu}
            onEditBankNote={onEditBankNote}
            onTypeChange={(newKind) => changeLineType(line, newKind)}
            onRemove={() => removeLine(line)}
            canRemove={
              line.kind === "fps" ||
              line.kind === "expense" ||
              (line.kind === "bankDeposited" && row.bankDeposited > 0) ||
              (line.kind === "bankPending" && row.bankPending > 0) ||
              (line.kind === "cancelled" && row.cancelled > 0)
            }
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200/80 pt-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="ledger-touch-btn flex-1 rounded-lg border border-emerald-700/30 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 active:bg-emerald-100"
            onClick={() => addFromDropdown("fps")}
          >
            ＋ 轉數快
          </button>
          <button
            type="button"
            className="ledger-touch-btn flex-1 rounded-lg border border-emerald-700/30 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 active:bg-emerald-100"
            onClick={() => addFromDropdown("expense")}
          >
            ＋ 其他支出
          </button>
        </div>
        <label className="block text-[11px] text-slate-500">
          或從清單選擇
          <select
            className="ledger-input ledger-touch-input mt-1 w-full cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-2.5 text-sm"
            value={addPick}
            onChange={(e) => {
              const v = e.target.value as "" | "fps" | "expense";
              setAddPick(v);
              if (v === "fps" || v === "expense") {
                addFromDropdown(v);
                setAddPick("");
              }
            }}
          >
            {ADD_OPTIONS.map((opt) => (
              <option key={opt.value || "placeholder"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-md bg-emerald-50/90 px-2.5 py-2 text-xs text-emerald-950">
        <div className="flex justify-between gap-2 font-semibold tabular-nums">
          <span>出帳合計（扣尾數）</span>
          <span>{formatNum(cashOut) || "0"}</span>
        </div>
        {row.cancelled > 0 ? (
          <p className="mt-1 text-[11px] font-normal text-emerald-900/80">
            撤單另自「總收入」扣除，不計入出帳合計。
          </p>
        ) : null}
      </div>
    </div>
  );
}

function OutflowLineRow({
  line,
  row,
  showAllNotes,
  formatNum,
  parseNum,
  getNote,
  onPatch,
  updateFps,
  updateExpense,
  onAmountContextMenu,
  onEditFpsNote,
  onEditExpenseNote,
  onBankContextMenu,
  onEditBankNote,
  onTypeChange,
  onRemove,
  canRemove,
}: {
  line: OutflowLine;
  row: DailyLedgerRow;
  showAllNotes: boolean;
  formatNum: (n: number) => string;
  parseNum: (raw: string) => number;
  getNote: (row: DailyLedgerRow, noteKey: LedgerNoteKey) => string | undefined;
  onPatch: (patch: Partial<DailyLedgerRow>) => void;
  updateFps: (id: string, patch: Partial<FpsEntry>) => void;
  updateExpense: (id: string, patch: Partial<ExpenseEntry>) => void;
  onAmountContextMenu: (
    e: React.MouseEvent,
    target:
      | { kind: "fps"; entryId: string }
      | { kind: "expense"; entryId: string },
  ) => void;
  onEditFpsNote: (entryId: string) => void;
  onEditExpenseNote: (entryId: string) => void;
  onBankContextMenu: (
    e: React.MouseEvent,
    noteKey: LedgerNoteKey,
  ) => void;
  onEditBankNote: (noteKey: LedgerNoteKey) => void;
  onTypeChange: (newKind: OutflowKind) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const kind = line.kind;

  const grid =
    "grid grid-cols-[minmax(6.5rem,7.5rem)_minmax(0,1fr)_5.25rem_1.5rem] items-start gap-1";

  const typeSelect = (
    <select
      className="ledger-input ledger-touch-input w-full cursor-pointer rounded-md border border-slate-200/80 bg-white px-1 py-2 text-xs"
      value={kind}
      onChange={(e) => onTypeChange(e.target.value as OutflowKind)}
      aria-label="支出類型"
    >
      {TYPE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );

  if (kind === "fps") {
    const entry = row.fpsEntries.find((e) => e.id === line.entryId);
    if (!entry) return null;
    return (
      <div className={grid}>
        {typeSelect}
        <select
          className="ledger-input ledger-touch-input min-w-0 cursor-pointer rounded-md border border-slate-200/80 bg-white text-sm"
          value={entry.channel}
          onChange={(e) =>
            updateFps(entry.id, {
              channel: e.target.value as FpsChannel,
            })
          }
          aria-label="轉數快方式"
        >
          {FPS_CHANNEL_OPTIONS.map((opt) => (
            <option key={opt.value || "empty"} value={opt.value}>
              {opt.label || "選擇方式"}
            </option>
          ))}
        </select>
        <NotableAmountCell
          variant="inline"
          noteKey="fpsAmount"
          note={entry.note}
          showAllNotes={showAllNotes}
          value={entry.amount}
          disabled={!entry.channel}
          placeholder="0"
          formatNum={formatNum}
          parseNum={parseNum}
          onValueChange={(amount) => updateFps(entry.id, { amount })}
          onContextMenu={(e) =>
            onAmountContextMenu(e, { kind: "fps", entryId: entry.id })
          }
          onEditNote={() => onEditFpsNote(entry.id)}
        />
        <RemoveBtn show={canRemove} onRemove={onRemove} label="移除轉數快" />
      </div>
    );
  }

  if (kind === "expense") {
    const entry = row.expenseEntries.find((e) => e.id === line.entryId);
    if (!entry) return null;
    return (
      <div className={grid}>
        {typeSelect}
        <input
          type="text"
          list={`expense-suggest-${entry.id}`}
          value={entry.label}
          onChange={(e) => updateExpense(entry.id, { label: e.target.value })}
          placeholder="選或輸入項目"
          className="ledger-input ledger-touch-input min-w-0 rounded-md border border-slate-200/80 bg-white text-sm"
          aria-label="支出項目"
        />
        <datalist id={`expense-suggest-${entry.id}`}>
          <option value="運輸" />
          <option value="人工" />
          <option value="雜費" />
          <option value="租金" />
        </datalist>
        <NotableAmountCell
          variant="inline"
          noteKey="expenses"
          note={entry.note}
          showAllNotes={showAllNotes}
          value={entry.amount}
          placeholder="0"
          formatNum={formatNum}
          parseNum={parseNum}
          onValueChange={(amount) => updateExpense(entry.id, { amount })}
          onContextMenu={(e) =>
            onAmountContextMenu(e, { kind: "expense", entryId: entry.id })
          }
          onEditNote={() => onEditExpenseNote(entry.id)}
        />
        <RemoveBtn show={canRemove} onRemove={onRemove} label="移除支出" />
      </div>
    );
  }

  const noteKey = bankNoteKey(kind);
  const amount = row[kind];

  return (
    <div className={grid}>
      {typeSelect}
      <div
        className="flex min-h-[2.75rem] items-center rounded-md border border-transparent px-2 text-sm text-slate-400 lg:min-h-0"
        aria-hidden
      >
        —
      </div>
      <NotableAmountCell
        variant="inline"
        noteKey={noteKey}
        note={getNote(row, noteKey)}
        showAllNotes={showAllNotes}
        value={amount}
        placeholder="0"
        formatNum={formatNum}
        parseNum={parseNum}
        onValueChange={(v) => onPatch({ [kind]: v })}
        onContextMenu={(e) => onBankContextMenu(e, noteKey)}
        onEditNote={() => onEditBankNote(noteKey)}
      />
      <RemoveBtn
        show={canRemove}
        onRemove={onRemove}
        label={`清除${TYPE_OPTIONS.find((o) => o.value === kind)?.label ?? ""}`}
      />
    </div>
  );
}

function RemoveBtn({
  show,
  onRemove,
  label,
}: {
  show: boolean;
  onRemove: () => void;
  label: string;
}) {
  if (!show) {
    return <span className="h-9 w-6" aria-hidden />;
  }
  return (
    <button
      type="button"
      className="ledger-touch-btn flex h-9 w-6 items-center justify-center text-slate-500 hover:text-red-600"
      aria-label={label}
      onClick={onRemove}
    >
      ×
    </button>
  );
}
