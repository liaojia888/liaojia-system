"use client";

import {
  FPS_CHANNEL_OPTIONS,
  isLedgerRowActive,
  type DailyLedgerComputed,
  type DailyLedgerRow,
  type FpsChannel,
  type LedgerNoteKey,
  type DailyLedgerTotals,
} from "@/lib/daily-ledger";

const FIELD_LABELS: Record<
  "fuel" | "water" | "urea" | "bankDeposited" | "bankPending" | "cancelled" | "expenses",
  string
> = {
  fuel: "油",
  water: "水",
  urea: "尿素",
  bankDeposited: "已入銀行",
  bankPending: "待入銀行",
  cancelled: "撤單",
  expenses: "支出",
};

export function DailyLedgerMobileRows({
  rows,
  totals,
  showAllNotes,
  formatNum,
  parseNum,
  getNote,
  updateRow,
  openRowMenu,
  openCellMenu,
}: {
  rows: DailyLedgerComputed[];
  totals: DailyLedgerTotals;
  showAllNotes: boolean;
  formatNum: (n: number) => string;
  parseNum: (raw: string) => number;
  getNote: (row: DailyLedgerRow, noteKey: LedgerNoteKey) => string | undefined;
  updateRow: (id: string, patch: Partial<DailyLedgerRow>) => void;
  openRowMenu: (rowId: string, el: HTMLElement) => void;
  openCellMenu: (
    rowId: string,
    noteKey: LedgerNoteKey,
    el: HTMLElement,
  ) => void;
}) {
  return (
    <div className="space-y-3 pb-2">
      {rows.map((row) => (
        <article
          key={row.id}
          className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <input
              type="date"
              value={row.date}
              onChange={(e) => updateRow(row.id, { date: e.target.value })}
              className="ledger-touch-input min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              className="ledger-touch-btn shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800"
              onClick={(e) => openRowMenu(row.id, e.currentTarget)}
            >
              列操作
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(["fuel", "water", "urea"] as const).map((field) => (
              <MobileAmountField
                key={field}
                label={FIELD_LABELS[field]}
                note={getNote(row, field)}
                showAllNotes={showAllNotes}
                value={row[field]}
                formatNum={formatNum}
                parseNum={parseNum}
                onChange={(v) => updateRow(row.id, { [field]: v })}
                onNotePress={(el) => openCellMenu(row.id, field, el)}
              />
            ))}
            <div className="col-span-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 sm:col-span-3">
              <span className="text-xs font-medium text-slate-600">品項小計</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">
                {formatNum(row.productSubtotal) || "—"}
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600">
              轉數快方式
              <select
                value={row.fpsChannel}
                onChange={(e) =>
                  updateRow(row.id, {
                    fpsChannel: e.target.value as FpsChannel,
                  })
                }
                className="ledger-touch-input mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              >
                {FPS_CHANNEL_OPTIONS.map((opt) => (
                  <option key={opt.value || "empty"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <MobileAmountField
              label="轉數快金額"
              note={getNote(row, "fpsAmount")}
              showAllNotes={showAllNotes}
              value={row.fpsAmount}
              disabled={!row.fpsChannel}
              placeholder={row.fpsChannel ? "0" : "先選方式"}
              formatNum={formatNum}
              parseNum={parseNum}
              onChange={(v) => updateRow(row.id, { fpsAmount: v })}
              onNotePress={(el) => openCellMenu(row.id, "fpsAmount", el)}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {(
              [
                "bankDeposited",
                "bankPending",
                "cancelled",
                "expenses",
              ] as const
            ).map((field) => (
              <MobileAmountField
                key={field}
                label={FIELD_LABELS[field]}
                note={getNote(row, field)}
                showAllNotes={showAllNotes}
                value={row[field]}
                formatNum={formatNum}
                parseNum={parseNum}
                onChange={(v) => updateRow(row.id, { [field]: v })}
                onNotePress={(el) => openCellMenu(row.id, field, el)}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <span className="text-sm font-medium text-emerald-900">尾數</span>
            <span className="text-base font-semibold tabular-nums text-emerald-900">
              {isLedgerRowActive(row)
                ? formatNum(row.balance) || "0"
                : "—"}
            </span>
          </div>
        </article>
      ))}

      <section className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-sm">
        <h3 className="font-semibold text-slate-900">本月總計</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:text-sm">
          <TotalItem label="油" value={formatNum(totals.fuel)} />
          <TotalItem label="水" value={formatNum(totals.water)} />
          <TotalItem label="尿素" value={formatNum(totals.urea)} />
          <TotalItem label="品項小計" value={formatNum(totals.productSubtotal)} />
          <TotalItem label="已入銀行" value={formatNum(totals.bankDeposited)} />
          <TotalItem label="待入銀行" value={formatNum(totals.bankPending)} />
          <TotalItem label="撤單" value={formatNum(totals.cancelled)} />
          <TotalItem label="支出" value={formatNum(totals.expenses)} />
          <div className="col-span-2 mt-1 flex justify-between border-t border-slate-300 pt-2 font-semibold text-emerald-900">
            <dt>期末尾數</dt>
            <dd className="tabular-nums">{formatNum(totals.closingBalance)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function TotalItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-600">{label}</dt>
      <dd className="tabular-nums text-slate-900">{value || "0"}</dd>
    </div>
  );
}

function MobileAmountField({
  label,
  note,
  showAllNotes,
  value,
  disabled,
  placeholder = "0",
  formatNum,
  parseNum,
  onChange,
  onNotePress,
}: {
  label: string;
  note?: string;
  showAllNotes: boolean;
  value: number;
  disabled?: boolean;
  placeholder?: string;
  formatNum: (n: number) => string;
  parseNum: (raw: string) => number;
  onChange: (v: number) => void;
  onNotePress: (el: HTMLElement) => void;
}) {
  const hasNote = Boolean(note?.trim());

  return (
    <label
      className={`block ${hasNote ? "rounded-lg bg-amber-50/80 p-1" : ""}`}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <button
          type="button"
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-900 hover:bg-amber-100"
          onClick={(e) => {
            e.preventDefault();
            onNotePress(e.currentTarget);
          }}
          aria-label={`${label}備註`}
        >
          {hasNote ? "備註" : "＋備註"}
        </button>
      </div>
      {showAllNotes && hasNote ? (
        <p className="mb-1 text-[10px] leading-snug text-amber-900">{note}</p>
      ) : null}
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={formatNum(value)}
        onChange={(e) => onChange(parseNum(e.target.value))}
        placeholder={placeholder}
        className="ledger-touch-input w-full rounded-lg border border-slate-200 px-3 py-2.5 text-right text-sm tabular-nums disabled:bg-slate-50 disabled:text-slate-400"
      />
    </label>
  );
}
