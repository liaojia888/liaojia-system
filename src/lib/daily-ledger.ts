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
  fpsChannel: FpsChannel;
  fpsAmount: number;
  bankDeposited: number;
  bankPending: number;
  cancelled: number;
  expenses: number;
  notes: LedgerNotes;
};

export type DailyLedgerComputed = DailyLedgerRow & {
  productSubtotal: number;
  totalRevenue: number;
  fpsCompany: number;
  fpsPrivate: number;
  fpsAlipay: number;
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

/** 該列是否有輸入（無輸入的列不顯示尾數，但仍會沿用前日結存計算） */
export function isLedgerRowActive(row: DailyLedgerRow): boolean {
  return (
    row.fuel > 0 ||
    row.water > 0 ||
    row.urea > 0 ||
    row.fpsAmount > 0 ||
    row.bankDeposited > 0 ||
    row.bankPending > 0 ||
    row.cancelled > 0 ||
    row.expenses > 0
  );
}

export function splitFpsAmount(
  channel: FpsChannel,
  amount: number,
): Pick<DailyLedgerComputed, "fpsCompany" | "fpsPrivate" | "fpsAlipay"> {
  return {
    fpsCompany: channel === "company" ? amount : 0,
    fpsPrivate: channel === "private" ? amount : 0,
    fpsAlipay: channel === "alipay" ? amount : 0,
  };
}

export function createEmptyRow(date: string): DailyLedgerRow {
  return {
    id: crypto.randomUUID(),
    date,
    fuel: 0,
    water: 0,
    urea: 0,
    fpsChannel: "",
    fpsAmount: 0,
    bankDeposited: 0,
    bankPending: 0,
    cancelled: 0,
    expenses: 0,
    notes: {},
  };
}

function parseNotes(raw: Record<string, unknown>): LedgerNotes {
  if (!raw.notes || typeof raw.notes !== "object") return {};
  return raw.notes as LedgerNotes;
}

/** 相容舊版本 localStorage（fpsCompany / fpsPrivate 分欄） */
export function normalizeRow(raw: Record<string, unknown>): DailyLedgerRow {
  const notes = parseNotes(raw);

  if (typeof raw.fpsChannel === "string" && "fpsAmount" in raw) {
    return { ...(raw as DailyLedgerRow), notes };
  }

  const fpsCompany = Number(raw.fpsCompany) || 0;
  const fpsPrivate = Number(raw.fpsPrivate) || 0;
  let fpsChannel: FpsChannel = "";
  let fpsAmount = 0;
  if (fpsCompany > 0) {
    fpsChannel = "company";
    fpsAmount = fpsCompany;
  } else if (fpsPrivate > 0) {
    fpsChannel = "private";
    fpsAmount = fpsPrivate;
  }

  return {
    id: String(raw.id),
    date: String(raw.date),
    fuel: Number(raw.fuel) || 0,
    water: Number(raw.water) || 0,
    urea: Number(raw.urea) || 0,
    fpsChannel,
    fpsAmount,
    bankDeposited: Number(raw.bankDeposited) || 0,
    bankPending: Number(raw.bankPending) || 0,
    cancelled: Number(raw.cancelled) || 0,
    expenses: Number(raw.expenses) || 0,
    notes,
  };
}

export function computeRows(rows: DailyLedgerRow[]): DailyLedgerComputed[] {
  let previousBalance = 0;
  return rows.map((row) => {
    const productSubtotal = row.fuel + row.water + row.urea;
    const totalRevenue = productSubtotal - row.cancelled;
    const fps = splitFpsAmount(row.fpsChannel, row.fpsAmount);
    const outflow =
      fps.fpsCompany +
      fps.fpsPrivate +
      fps.fpsAlipay +
      row.bankDeposited +
      row.expenses;
    const balance = previousBalance + totalRevenue - outflow;
    previousBalance = balance;
    return {
      ...row,
      ...fps,
      productSubtotal,
      totalRevenue,
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
