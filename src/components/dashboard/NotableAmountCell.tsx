"use client";

import type { LedgerNoteKey } from "@/lib/daily-ledger";

type NotableAmountCellProps = {
  noteKey: LedgerNoteKey;
  note?: string;
  showAllNotes: boolean;
  value: number;
  disabled?: boolean;
  placeholder?: string;
  formatNum: (n: number) => string;
  parseNum: (raw: string) => number;
  onValueChange: (value: number) => void;
  onContextMenu: (
    e: React.MouseEvent,
    noteKey: LedgerNoteKey,
  ) => void;
};

export function NotableAmountCell({
  noteKey,
  note,
  showAllNotes,
  value,
  disabled,
  placeholder = "0",
  formatNum,
  parseNum,
  onValueChange,
  onContextMenu,
}: NotableAmountCellProps) {
  const hasNote = Boolean(note?.trim());

  return (
    <td
      className={`ledger-td ${hasNote ? "ledger-td-has-note" : ""}`}
      onContextMenu={(e) => onContextMenu(e, noteKey)}
    >
      <div
        className={`ledger-cell-wrap ${showAllNotes && hasNote ? "ledger-show-all-notes" : ""}`}
      >
        {hasNote ? (
          <div className="ledger-note-top-right" role="note">
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
          className="ledger-input text-right tabular-nums disabled:bg-slate-50 disabled:text-slate-400"
          placeholder={placeholder}
        />
      </div>
    </td>
  );
}
