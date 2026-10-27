import {
  createEmptyRow,
  sortRowsByDate,
  type DailyLedgerRow,
  type ExpenseEntry,
  type FpsChannel,
  type FpsEntry,
} from "@/lib/daily-ledger";

const FPS_LABEL_TO_CHANNEL: Record<string, FpsChannel> = {
  公司: "company",
  私人: "private",
  Alipay: "alipay",
};

function parseMoney(raw: string): number {
  const v = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(v) ? v : 0;
}

function parseIsoDateFromLine(line: string): string | null {
  const m = line.match(/日期[：:]\s*(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function pushFpsEntry(
  entries: FpsEntry[],
  label: string,
  amountRaw: string,
) {
  const channel = FPS_LABEL_TO_CHANNEL[label];
  if (!channel) return;
  const amount = parseMoney(amountRaw);
  if (amount <= 0) return;
  entries.push({
    id: crypto.randomUUID(),
    channel,
    amount,
  });
}

function pushExpenseFromBody(entries: ExpenseEntry[], body: string) {
  const trimmed = body.trim();
  if (!trimmed || trimmed === "—") return;
  const matched = trimmed.match(/^(.+?)\s+([\d,]+)$/);
  if (matched) {
    entries.push({
      id: crypto.randomUUID(),
      label: matched[1].trim(),
      amount: parseMoney(matched[2]),
    });
    return;
  }
  const amount = parseMoney(trimmed);
  if (amount > 0) {
    entries.push({
      id: crypto.randomUUID(),
      label: "",
      amount,
    });
  }
}

/** 解析 WhatsApp「匯出此列」文字，還原成日結列（供本機／雲端合併） */
export function parseLedgerRowFromWhatsApp(text: string): DailyLedgerRow | null {
  if (!text.includes("日結單列")) return null;

  const lines = text.split(/\r?\n/).map((l) => l.trim());
  let date: string | null = null;
  let fuel = 0;
  let water = 0;
  let urea = 0;
  let bankDeposited = 0;
  let bankPending = 0;
  let cancelled = 0;
  const fpsEntries: FpsEntry[] = [];
  const expenseEntries: ExpenseEntry[] = [];

  for (const line of lines) {
    if (!line) continue;

    if (line.startsWith("日期")) {
      date = parseIsoDateFromLine(line);
      continue;
    }

    let m = line.match(/^油收入[：:]\s*([\d,]+)/);
    if (m) {
      fuel = parseMoney(m[1]);
      continue;
    }
    m = line.match(/^水收入[：:]\s*([\d,]+)/);
    if (m) {
      water = parseMoney(m[1]);
      continue;
    }
    m = line.match(/^尿素收入[：:]\s*([\d,]+)/);
    if (m) {
      urea = parseMoney(m[1]);
      continue;
    }

    m = line.match(/^[·•]\s*(公司|私人|Alipay)\s+([\d,]+)/);
    if (m) {
      pushFpsEntry(fpsEntries, m[1], m[2]);
      continue;
    }
    m = line.match(/^轉數快[：:]\s*(公司|私人|Alipay)\s+([\d,]+)/);
    if (m) {
      pushFpsEntry(fpsEntries, m[1], m[2]);
      continue;
    }

    m = line.match(/^已入銀行[（(]公司[）)]?[：:]\s*([\d,]+)/);
    if (m) {
      bankDeposited = parseMoney(m[1]);
      continue;
    }
    m = line.match(/^待入銀行[（(]公司[）)]?[：:]\s*([\d,]+)/);
    if (m) {
      bankPending = parseMoney(m[1]);
      continue;
    }
    m = line.match(/^撤單[：:]\s*([\d,]+)/);
    if (m) {
      cancelled = parseMoney(m[1]);
      continue;
    }
    m = line.match(/^支出[：:]\s*(.+)$/);
    if (m) {
      pushExpenseFromBody(expenseEntries, m[1]);
    }
  }

  if (!date) return null;

  const base = createEmptyRow(date);
  return {
    ...base,
    fuel,
    water,
    urea,
    fpsEntries: fpsEntries.length ? fpsEntries : base.fpsEntries,
    bankDeposited,
    bankPending,
    cancelled,
    expenseEntries: expenseEntries.length
      ? expenseEntries
      : base.expenseEntries,
  };
}

export function mergeParsedRowIntoMonth(
  rows: DailyLedgerRow[],
  parsed: DailyLedgerRow,
): DailyLedgerRow[] {
  const hasDate = rows.some((r) => r.date === parsed.date);
  if (!hasDate) {
    return sortRowsByDate([...rows, parsed]);
  }
  return sortRowsByDate(
    rows.map((row) =>
      row.date === parsed.date ? { ...parsed, id: row.id } : row,
    ),
  );
}

export function monthKeyFromIsoDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}
