export type FpsChannel = "" | "company" | "private" | "alipay";

export const FPS_CHANNEL_OPTIONS: {
  value: FpsChannel;
  label: string;
}[] = [
  { value: "", label: "— 請選擇 —" },
  { value: "company", label: "公司" },
  { value: "private", label: "私人" },
  { value: "alipay", label: "Alipay" },
];

export type FpsEntry = {
  id: string;
  channel: FpsChannel;
  amount: number;
  note?: string;
};

export type ExpenseEntry = {
  id: string;
  /** 支出項目說明（選填） */
  label: string;
  amount: number;
  note?: string;
};

export type LedgerNoteKey =
  | "fuel"
  | "water"
  | "urea"
  | "fpsAmount"
  | "bankDeposited"
  | "bankPending"
  | "cancelled"
  | "expenses";

export type LedgerNotes = Partial<Record<LedgerNoteKey, string>>;

export const LEDGER_NOTE_LABELS: Record<LedgerNoteKey, string> = {
  fuel: "油",
  water: "水",
  urea: "尿素",
  fpsAmount: "轉數快金額",
  bankDeposited: "已入銀行",
  bankPending: "待入銀行",
  cancelled: "撤單",
  expenses: "支出",
};

export type DailyLedgerRow = {
  id: string;
  date: string;
  fuel: number;
  water: number;
  urea: number;
  fpsEntries: FpsEntry[];
  bankDeposited: number;
  bankPending: number;
  cancelled: number;
  expenseEntries: ExpenseEntry[];
  notes: LedgerNotes;
};

export type DailyLedgerComputed = DailyLedgerRow & {
  productSubtotal: number;
  totalRevenue: number;
  fpsCompany: number;
  fpsPrivate: number;
  fpsAlipay: number;
  /** 當列支出加總（由 expenseEntries 計算） */
  expenses: number;
  balance: number;
};

export type DailyLedgerTotals = {
  fuel: number;
  water: number;
  urea: number;
  productSubtotal: number;
  totalRevenue: number;
  fpsCompany: number;
  fpsPrivate: number;
  fpsAlipay: number;
  bankDeposited: number;
  bankPending: number;
  cancelled: number;
  expenses: number;
  closingBalance: number;
};

export function createEmptyFpsEntry(): FpsEntry {
  return {
    id: crypto.randomUUID(),
    channel: "",
    amount: 0,
  };
}

export function createEmptyExpenseEntry(): ExpenseEntry {
  return {
    id: crypto.randomUUID(),
    label: "",
    amount: 0,
  };
}

export function fpsLabel(channel: FpsChannel): string {
  return FPS_CHANNEL_OPTIONS.find((o) => o.value === channel)?.label ?? "—";
}

/** 單筆轉數快是否計入尾數流出 */
export function isFpsEntryCounted(entry: FpsEntry): boolean {
  return Boolean(entry.channel) && entry.amount > 0;
}

export function totalFpsOutflow(entries: FpsEntry[]): number {
  return entries.reduce(
    (sum, e) => (isFpsEntryCounted(e) ? sum + e.amount : sum),
    0,
  );
}

export function aggregateFpsEntries(
  entries: FpsEntry[],
): Pick<DailyLedgerComputed, "fpsCompany" | "fpsPrivate" | "fpsAlipay"> {
  let fpsCompany = 0;
  let fpsPrivate = 0;
  let fpsAlipay = 0;
  for (const e of entries) {
    if (!isFpsEntryCounted(e)) continue;
    if (e.channel === "company") fpsCompany += e.amount;
    else if (e.channel === "private") fpsPrivate += e.amount;
    else if (e.channel === "alipay") fpsAlipay += e.amount;
  }
  return { fpsCompany, fpsPrivate, fpsAlipay };
}

export function formatFpsEntriesSummary(entries: FpsEntry[]): string {
  const parts = entries
    .filter(isFpsEntryCounted)
    .map((e) => `${fpsLabel(e.channel)} ${e.amount.toLocaleString("zh-TW")}`);
  return parts.join("；") || "";
}

export function isExpenseEntryCounted(entry: ExpenseEntry): boolean {
  return entry.amount > 0;
}

export function totalExpenseOutflow(entries: ExpenseEntry[]): number {
  return entries.reduce(
    (sum, e) => (isExpenseEntryCounted(e) ? sum + e.amount : sum),
    0,
  );
}

export function formatExpenseEntriesSummary(entries: ExpenseEntry[]): string {
  const parts = entries.filter(isExpenseEntryCounted).map((e) => {
    const head = e.label.trim() ? `${e.label.trim()} ` : "支出 ";
    return `${head}${e.amount.toLocaleString("zh-TW")}`;
  });
  return parts.join("；") || "";
}

/** 該列是否有輸入（無輸入的列不顯示尾數，但仍會沿用前日結存計算） */
export function isLedgerRowActive(row: DailyLedgerRow): boolean {
  return (
    row.fuel > 0 ||
    row.water > 0 ||
    row.urea > 0 ||
    row.fpsEntries.some(isFpsEntryCounted) ||
    row.bankDeposited > 0 ||
    row.bankPending > 0 ||
    row.cancelled > 0 ||
    row.expenseEntries.some(isExpenseEntryCounted)
  );
}

export function rowHasLedgerInput(row: DailyLedgerRow): boolean {
  return isLedgerRowActive(row) || rowHasAnyNotes(row);
}

export function rowHasAnyNotes(row: DailyLedgerRow): boolean {
  if (Object.keys(row.notes ?? {}).some((k) => row.notes[k as LedgerNoteKey]?.trim())) {
    return true;
  }
  if (row.fpsEntries.some((e) => e.note?.trim())) return true;
  return row.expenseEntries.some((e) => e.note?.trim());
}

export function createEmptyRow(date: string): DailyLedgerRow {
  return {
    id: crypto.randomUUID(),
    date,
    fuel: 0,
    water: 0,
    urea: 0,
    fpsEntries: [],
    bankDeposited: 0,
    bankPending: 0,
    cancelled: 0,
    expenseEntries: [],
    notes: {},
  };
}

function parseNotes(raw: Record<string, unknown>): LedgerNotes {
  if (!raw.notes || typeof raw.notes !== "object") return {};
  return raw.notes as LedgerNotes;
}

function normalizeFpsEntry(raw: unknown): FpsEntry {
  const r = raw as Record<string, unknown>;
  const note =
    typeof r.note === "string" && r.note.trim() ? r.note.trim() : undefined;
  return {
    id: typeof r.id === "string" ? r.id : crypto.randomUUID(),
    channel: (typeof r.channel === "string" ? r.channel : "") as FpsChannel,
    amount: Number(r.amount) || 0,
    note,
  };
}

function legacyFpsEntriesFromRaw(
  raw: Record<string, unknown>,
  notes: LedgerNotes,
): FpsEntry[] {
  const entries: FpsEntry[] = [];
  const legacyNote = notes.fpsAmount?.trim();

  if (typeof raw.fpsChannel === "string" && "fpsAmount" in raw) {
    const channel = raw.fpsChannel as FpsChannel;
    const amount = Number(raw.fpsAmount) || 0;
    if (channel && amount > 0) {
      entries.push({
        id: crypto.randomUUID(),
        channel,
        amount,
        note: legacyNote,
      });
    }
    return entries;
  }

  const fpsCompany = Number(raw.fpsCompany) || 0;
  const fpsPrivate = Number(raw.fpsPrivate) || 0;
  if (fpsCompany > 0) {
    entries.push({
      id: crypto.randomUUID(),
      channel: "company",
      amount: fpsCompany,
      note: legacyNote,
    });
  } else if (fpsPrivate > 0) {
    entries.push({
      id: crypto.randomUUID(),
      channel: "private",
      amount: fpsPrivate,
    });
  }

  return entries;
}

function normalizeExpenseEntry(raw: unknown): ExpenseEntry {
  const r = raw as Record<string, unknown>;
  const note =
    typeof r.note === "string" && r.note.trim() ? r.note.trim() : undefined;
  return {
    id: typeof r.id === "string" ? r.id : crypto.randomUUID(),
    label: typeof r.label === "string" ? r.label : "",
    amount: Number(r.amount) || 0,
    note,
  };
}

function legacyExpenseEntriesFromRaw(
  raw: Record<string, unknown>,
  notes: LedgerNotes,
): ExpenseEntry[] {
  const amount = Number(raw.expenses) || 0;
  if (amount <= 0) return [];
  const legacyNote = notes.expenses?.trim();
  return [
    {
      id: crypto.randomUUID(),
      label: "",
      amount,
      note: legacyNote,
    },
  ];
}

function normalizeFpsEntriesFromRaw(
  raw: Record<string, unknown>,
  notes: LedgerNotes,
): FpsEntry[] {
  if (Array.isArray(raw.fpsEntries)) {
    let fpsEntries = raw.fpsEntries.map(normalizeFpsEntry);
    const legacyNote = notes.fpsAmount?.trim();
    if (
      legacyNote &&
      !fpsEntries.some((e) => e.note?.trim()) &&
      fpsEntries.some(isFpsEntryCounted)
    ) {
      const idx = fpsEntries.findIndex(isFpsEntryCounted);
      fpsEntries = fpsEntries.map((e, i) =>
        i === idx ? { ...e, note: legacyNote } : e,
      );
    }
    delete notes.fpsAmount;
    return fpsEntries;
  }

  const fpsEntries = legacyFpsEntriesFromRaw(raw, notes);
  if (fpsEntries.length && notes.fpsAmount) {
    delete notes.fpsAmount;
  }
  return fpsEntries;
}

function normalizeExpenseEntriesFromRaw(
  raw: Record<string, unknown>,
  notes: LedgerNotes,
): ExpenseEntry[] {
  if (Array.isArray(raw.expenseEntries)) {
    let expenseEntries = raw.expenseEntries.map(normalizeExpenseEntry);
    if (!expenseEntries.some(isExpenseEntryCounted)) {
      const legacy = legacyExpenseEntriesFromRaw(raw, notes);
      if (legacy.length) expenseEntries = legacy;
    } else {
      const legacyNote = notes.expenses?.trim();
      if (
        legacyNote &&
        !expenseEntries.some((e) => e.note?.trim())
      ) {
        const idx = expenseEntries.findIndex(isExpenseEntryCounted);
        expenseEntries = expenseEntries.map((e, i) =>
          i === idx ? { ...e, note: legacyNote } : e,
        );
      }
    }
    if (expenseEntries.length && notes.expenses) {
      delete notes.expenses;
    }
    return expenseEntries;
  }

  const expenseEntries = legacyExpenseEntriesFromRaw(raw, notes);
  if (expenseEntries.length && notes.expenses) {
    delete notes.expenses;
  }
  return expenseEntries;
}

/** 相容舊版本（fpsChannel / fpsAmount、單一 expenses 等） */
export function normalizeRow(raw: Record<string, unknown>): DailyLedgerRow {
  const notes = { ...parseNotes(raw) };

  const base: Omit<DailyLedgerRow, "fpsEntries" | "expenseEntries"> = {
    id: String(raw.id),
    date: String(raw.date),
    fuel: Number(raw.fuel) || 0,
    water: Number(raw.water) || 0,
    urea: Number(raw.urea) || 0,
    bankDeposited: Number(raw.bankDeposited) || 0,
    bankPending: Number(raw.bankPending) || 0,
    cancelled: Number(raw.cancelled) || 0,
    notes,
  };

  const fpsEntries = normalizeFpsEntriesFromRaw(raw, notes);
  const expenseEntries = normalizeExpenseEntriesFromRaw(raw, notes);

  return { ...base, notes, fpsEntries, expenseEntries };
}

export function computeRows(rows: DailyLedgerRow[]): DailyLedgerComputed[] {
  let previousBalance = 0;
  return rows.map((row) => {
    const productSubtotal = row.fuel + row.water + row.urea;
    const totalRevenue = productSubtotal - row.cancelled;
    const fps = aggregateFpsEntries(row.fpsEntries);
    const expenses = totalExpenseOutflow(row.expenseEntries);
    const outflow =
      totalFpsOutflow(row.fpsEntries) +
      row.bankDeposited +
      row.bankPending +
      expenses;
    const balance = previousBalance + totalRevenue - outflow;
    previousBalance = balance;
    return {
      ...row,
      ...fps,
      productSubtotal,
      totalRevenue,
      expenses,
      balance,
    };
  });
}

export function computeTotals(computed: DailyLedgerComputed[]): DailyLedgerTotals {
  const base = computed.reduce(
    (acc, row) => ({
      fuel: acc.fuel + row.fuel,
      water: acc.water + row.water,
      urea: acc.urea + row.urea,
      productSubtotal: acc.productSubtotal + row.productSubtotal,
      totalRevenue: acc.totalRevenue + row.totalRevenue,
      fpsCompany: acc.fpsCompany + row.fpsCompany,
      fpsPrivate: acc.fpsPrivate + row.fpsPrivate,
      fpsAlipay: acc.fpsAlipay + row.fpsAlipay,
      bankDeposited: acc.bankDeposited + row.bankDeposited,
      bankPending: acc.bankPending + row.bankPending,
      cancelled: acc.cancelled + row.cancelled,
      expenses: acc.expenses + row.expenses,
      closingBalance: 0,
    }),
    {
      fuel: 0,
      water: 0,
      urea: 0,
      productSubtotal: 0,
      totalRevenue: 0,
      fpsCompany: 0,
      fpsPrivate: 0,
      fpsAlipay: 0,
      bankDeposited: 0,
      bankPending: 0,
      cancelled: 0,
      expenses: 0,
      closingBalance: 0,
    },
  );
  base.closingBalance = computed.at(-1)?.balance ?? 0;
  return base;
}

export function sortRowsByDate(rows: DailyLedgerRow[]): DailyLedgerRow[] {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

export function defaultRowsForMonth(year: number, month: number): DailyLedgerRow[] {
  const days = new Date(year, month, 0).getDate();
  const rows: DailyLedgerRow[] = [];
  for (let d = 1; d <= days; d++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    rows.push(createEmptyRow(date));
  }
  return rows;
}

export const LEDGER_STORAGE_KEY = "accounting-daily-ledger";
