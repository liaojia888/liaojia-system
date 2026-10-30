"use client";

import {
  createEmptyExpenseEntry,
  totalExpenseOutflow,
  type ExpenseEntry,
} from "@/lib/daily-ledger";
import { NotableAmountCell } from "@/components/dashboard/NotableAmountCell";

/** 試算表／手機共用：每日多筆支出（項目＋金額＋備註） */
export function LedgerExpenseEntriesEditor({
  entries,
  showAllNotes,
  formatNum,
  parseNum,
  onChange,
  onAmountContextMenu,
  onEditEntryNote,
}: {
  entries: ExpenseEntry[];
  showAllNotes: boolean;
  formatNum: (n: number) => string;
  parseNum: (raw: string) => number;
  onChange: (entries: ExpenseEntry[]) => void;
  onAmountContextMenu: (e: React.MouseEvent, entryId: string) => void;
  onEditEntryNote: (entryId: string) => void;
}) {
  const subtotal = totalExpenseOutflow(entries);

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
    <div className="flex min-w-[12rem] flex-col gap-1.5 py-0.5">
      {entries.length > 0 ? (
        <>
          <div
            className="grid grid-cols-[minmax(0,1fr)_5.75rem_1.75rem] items-center gap-1 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            aria-hidden
          >
            <span>項目</span>
            <span className="text-right">金額</span>
            <span />
          </div>
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="grid grid-cols-[minmax(0,1fr)_5.75rem_1.75rem] items-start gap-1"
            >
              <input
                type="text"
                value={entry.label}
                onChange={(e) =>
                  updateEntry(entry.id, { label: e.target.value })
                }
                placeholder="例如：運輸"
                className="ledger-input ledger-touch-input min-w-0 text-sm"
              />
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
              <button
                type="button"
                className="ledger-touch-btn flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-base text-slate-500 hover:bg-slate-100"
                title="移除此筆支出"
                aria-label="移除此筆支出"
                onClick={() => removeEntry(entry.id)}
              >
                ×
              </button>
            </div>
          ))}
          <p className="text-right text-xs font-medium tabular-nums text-slate-600">
            當日小計 {formatNum(subtotal) || "0"}
          </p>
        </>
      ) : (
        <p className="text-xs text-slate-400">尚無支出，請新增</p>
      )}
      <button
        type="button"
        className="ledger-touch-btn self-start rounded-md border border-dashed border-emerald-600/40 bg-emerald-50/50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-50"
        onClick={addEntry}
      >
        ＋ 新增支出
      </button>
    </div>
  );
}
