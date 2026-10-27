import {
  formatExpenseEntriesSummary,
  formatFpsEntriesSummary,
  LEDGER_NOTE_LABELS,
  totalExpenseOutflow,
  totalFpsOutflow,
  type DailyLedgerComputed,
  type DailyLedgerRow,
  type LedgerNoteKey,
} from "@/lib/daily-ledger";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildMonthCsv(
  monthKey: string,
  rows: DailyLedgerRow[],
  computed: DailyLedgerComputed[],
): string {
  const headers = [
    "日期",
    "油",
    "水",
    "尿素",
    "總收入",
    "轉數快明細",
    "轉數快合計",
    "已入銀行",
    "待入銀行",
    "撤單",
    "支出明細",
    "支出合計",
    "尾數",
    "備註摘要",
  ];

  const byId = new Map(computed.map((r) => [r.id, r]));

  const lines = rows.map((row) => {
    const c = byId.get(row.id);
    const noteParts = (Object.keys(row.notes ?? {}) as LedgerNoteKey[])
      .filter((k) => row.notes?.[k]?.trim())
      .map((k) => `${LEDGER_NOTE_LABELS[k]}:${row.notes![k]!.trim()}`);
    for (const entry of row.fpsEntries) {
      if (entry.note?.trim()) {
        noteParts.push(`轉數快:${entry.note.trim()}`);
      }
    }
    for (const entry of row.expenseEntries) {
      if (entry.note?.trim()) {
        const head = entry.label.trim() || "支出";
        noteParts.push(`${head}:${entry.note.trim()}`);
      }
    }

    return [
      row.date,
      row.fuel,
      row.water,
      row.urea,
      c?.productSubtotal ?? 0,
      formatFpsEntriesSummary(row.fpsEntries),
      totalFpsOutflow(row.fpsEntries),
      row.bankDeposited,
      row.bankPending,
      row.cancelled,
      formatExpenseEntriesSummary(row.expenseEntries),
      totalExpenseOutflow(row.expenseEntries),
      c?.balance ?? 0,
      noteParts.join(" | "),
    ]
      .map((v) => escapeCsv(String(v ?? "")))
      .join(",");
  });

  return `\uFEFF${headers.join(",")}\n${lines.join("\n")}\n`;
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/plain;charset=utf-8",
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJsonBackup(payload: unknown, filename: string) {
  downloadTextFile(
    filename,
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8",
  );
}
