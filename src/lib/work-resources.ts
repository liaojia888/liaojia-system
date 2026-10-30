export const WORK_RESOURCE_STORAGE_KEY = "accounting-work-resources";

export const WORK_RESOURCE_CATEGORIES = [
  { key: "largeMachine", label: "大機", sign: 1 as const },
  { key: "smallMachine", label: "細機", sign: 1 as const },
  { key: "testGun", label: "試槍", sign: -1 as const },
  { key: "oilLeak", label: "漏油", sign: -1 as const },
] as const;

export type WorkResourceCategoryKey =
  (typeof WORK_RESOURCE_CATEGORIES)[number]["key"];

export type WorkResourceCounts = Record<WorkResourceCategoryKey, number>;

export type WorkResourceRow = {
  id: string;
  date: string;
  counts: WorkResourceCounts;
  note: string;
};

export type WorkResourceComputedRow = WorkResourceRow & {
  /** 當日：大機 + 細機 − 試槍 − 漏油 */
  dailyNet: number;
  /** 自月初逐日累加 dailyNet */
  cumulative: number;
};

export type WorkResourceMonthTotals = WorkResourceCounts & {
  totalDailyNet: number;
  closingCumulative: number;
};

function emptyCounts(): WorkResourceCounts {
  return {
    largeMachine: 0,
    smallMachine: 0,
    testGun: 0,
    oilLeak: 0,
  };
}

export function createEmptyWorkResourceRow(date: string): WorkResourceRow {
  return {
    id: crypto.randomUUID(),
    date,
    counts: emptyCounts(),
    note: "",
  };
}

function parseCount(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** 舊版 flows（進／出）→ 單一數量：進 − 出 */
function countsFromLegacyFlows(raw: Record<string, unknown>): WorkResourceCounts | null {
  const flows = raw.flows;
  if (!flows || typeof flows !== "object") return null;
  const o = flows as Record<string, unknown>;
  const counts = emptyCounts();
  let any = false;
  for (const { key } of WORK_RESOURCE_CATEGORIES) {
    const pair = o[key];
    if (pair && typeof pair === "object") {
      const p = pair as Record<string, unknown>;
      const inn = parseCount(p.in);
      const out = parseCount(p.out);
      if (inn !== 0 || out !== 0) any = true;
      counts[key] = inn - out;
    }
  }
  return any ? counts : null;
}

export function normalizeWorkResourceRow(
  raw: Record<string, unknown>,
): WorkResourceRow {
  const counts = emptyCounts();

  if (raw.counts && typeof raw.counts === "object") {
    const c = raw.counts as Record<string, unknown>;
    for (const { key } of WORK_RESOURCE_CATEGORIES) {
      counts[key] = parseCount(c[key]);
    }
  } else {
    const legacy = countsFromLegacyFlows(raw);
    if (legacy) {
      Object.assign(counts, legacy);
    }
  }

  for (const { key } of WORK_RESOURCE_CATEGORIES) {
    const direct = raw[key];
    if (direct !== undefined) counts[key] = parseCount(direct);
  }

  return {
    id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
    date: typeof raw.date === "string" ? raw.date : "",
    counts,
    note: typeof raw.note === "string" ? raw.note : "",
  };
}

export function sortWorkResourceRows(rows: WorkResourceRow[]): WorkResourceRow[] {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

export function defaultWorkResourceRowsForMonth(
  year: number,
  month: number,
): WorkResourceRow[] {
  const days = new Date(year, month, 0).getDate();
  const rows: WorkResourceRow[] = [];
  for (let d = 1; d <= days; d++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    rows.push(createEmptyWorkResourceRow(date));
  }
  return rows;
}

export function workResourceDailyNet(row: WorkResourceRow): number {
  const c = row.counts;
  return c.largeMachine + c.smallMachine - c.testGun - c.oilLeak;
}

export function workResourceRowHasData(row: WorkResourceRow): boolean {
  if (row.note.trim()) return true;
  return WORK_RESOURCE_CATEGORIES.some(({ key }) => row.counts[key] !== 0);
}

export function computeWorkResourceRows(
  rows: WorkResourceRow[],
): WorkResourceComputedRow[] {
  let cumulative = 0;
  return sortWorkResourceRows(rows).map((row) => {
    const dailyNet = workResourceDailyNet(row);
    cumulative += dailyNet;
    return { ...row, dailyNet, cumulative };
  });
}

export function computeWorkResourceMonthTotals(
  computed: WorkResourceComputedRow[],
): WorkResourceMonthTotals {
  const base = emptyCounts();
  for (const row of computed) {
    for (const { key } of WORK_RESOURCE_CATEGORIES) {
      base[key] += row.counts[key];
    }
  }
  const totalDailyNet = computed.reduce((s, r) => s + r.dailyNet, 0);
  const closingCumulative =
    computed.length > 0 ? computed[computed.length - 1].cumulative : 0;
  return {
    ...base,
    totalDailyNet,
    closingCumulative,
  };
}

export function mergeWorkResourceMonthByDate(
  template: WorkResourceRow[],
  remote: WorkResourceRow[],
): WorkResourceRow[] {
  const byDate = new Map(
    remote.map((r) => [
      r.date,
      normalizeWorkResourceRow(r as unknown as Record<string, unknown>),
    ]),
  );
  return template.map((row) => {
    const hit = byDate.get(row.date);
    if (!hit) return row;
    return {
      ...row,
      counts: hit.counts,
      note: hit.note,
    };
  });
}

export function monthHasWorkResourceData(rows: WorkResourceRow[]): boolean {
  return rows.some(workResourceRowHasData);
}
