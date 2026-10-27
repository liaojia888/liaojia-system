"use client";

import type { LedgerNoteKey } from "@/lib/daily-ledger";

type NotableAmountCellProps = {
  noteKey: LedgerNoteKey;
  note?: string;
  showAllNotes: boolean;
  value: number;
  disabled?: boolean;
  placeholder?: string;
  /** 嵌在合併儲存格（如多筆轉數快）內時使用 */
  variant?: "cell" | "inline";
  formatNum: (n: number) => string;
  parseNum: (raw: string) => number;
  onValueChange: (value: number) => void;
  onContextMenu: (
    e: React.MouseEvent,
    noteKey: LedgerNoteKey,
  ) => void;
  /** inline 時顯示「＋備註」按鈕（轉數快／支出多筆） */
  onEditNote?: () => void;
};

export function NotableAmountCell({
  noteKey,
  note,
  showAllNotes,
  value,
  disabled,
  placeholder = "0",
  variant = "cell",
  formatNum,
  parseNum,
  onValueChange,
  onContextMenu,
  onEditNote,
}: NotableAmountCellProps) {
  const hasNote = Boolean(note?.trim());

  const inner = (
    <div
      className={`ledger-cell-wrap ${showAllNotes && hasNote ? "ledger-show-all-notes" : ""}`}
    >
      {variant === "inline" && onEditNote ? (
        <div className="mb-0.5 flex justify-end">
          <button
            type="button"
            className="rounded px-1 py-0.5 text-[10px] font-medium text-amber-900 hover:bg-amber-100"
            onClick={(e) => {
              e.stopPropagation();
              onEditNote();
            }}
          >
            {hasNote ? "備註" : "＋備註"}
          </button>
        </div>
      ) : null}
      {hasNote ? (
        <div
          className={
            variant === "inline"
              ? "mb-0.5 text-[10px] leading-snug text-amber-900"
              : "ledger-note-top-right"
          }
          role="note"
        >
          {note}
        </div>
      ) : null}
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={formatNum(value)}
        onChange={(e) => onValueChange(parseNum(e.target.value))}
        data-ledger-field={noteKey}
        className="ledger-input w-full text-right tabular-nums disabled:bg-slate-50 disabled:text-slate-400"
        placeholder={placeholder}
      />
    </div>
  );

  if (variant === "inline") {
    return (
      <div
        className={`${hasNote ? "ledger-td-has-note rounded-md" : ""}`}
        onContextMenu={(e) => onContextMenu(e, noteKey)}
      >
        {inner}
      </div>
    );
  }

  return (
    <td
      className={`ledger-td ${hasNote ? "ledger-td-has-note" : ""}`}
      onContextMenu={(e) => onContextMenu(e, noteKey)}
    >
      {inner}
    </td>
  );
}
