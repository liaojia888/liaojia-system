import { describe, expect, it } from "vitest";
import {
  computeRows,
  computeTotals,
  createEmptyRow,
  normalizeRow,
  type DailyLedgerRow,
} from "@/lib/daily-ledger";

function row(
  date: string,
  patch: Partial<Omit<DailyLedgerRow, "id" | "date" | "notes">> = {},
): DailyLedgerRow {
  return {
    ...createEmptyRow(date),
    id: `test-${date}`,
    ...patch,
  };
}

describe("computeRows 尾數累計", () => {
  it("單日收入計入尾數", () => {
    const [r1] = computeRows([row("2026-01-01", { fuel: 1000 })]);
    expect(r1.totalRevenue).toBe(1000);
    expect(r1.balance).toBe(1000);
  });

  it("前日尾數累計至下一列", () => {
    const computed = computeRows([
      row("2026-01-01", { fuel: 1000 }),
      row("2026-01-02", {
        expenseEntries: [{ id: "e1", label: "", amount: 300 }],
      }),
    ]);
    expect(computed[1].dailyBalance).toBe(-300);
    expect(computed[1].balance).toBe(700);
  });

  it("中間空白列仍延續前日尾數計算", () => {
    const computed = computeRows([
      row("2026-01-01", { fuel: 500 }),
      row("2026-01-02"),
      row("2026-01-03", { water: 200 }),
    ]);
    expect(computed[1].balance).toBe(500);
    expect(computed[2].balance).toBe(700);
  });

  it("撤單扣減總收入", () => {
    const [r1] = computeRows([
      row("2026-01-01", { fuel: 1000, cancelled: 150 }),
    ]);
    expect(r1.totalRevenue).toBe(850);
    expect(r1.balance).toBe(850);
  });

  it("轉數快、已入銀行、待入銀行、支出皆減少尾數", () => {
    const [r1] = computeRows([
      row("2026-01-01", {
        fuel: 2000,
        fpsEntries: [
          { id: "fps-1", channel: "company", amount: 400 },
        ],
        bankDeposited: 300,
        bankPending: 999,
        expenseEntries: [{ id: "ex-1", label: "", amount: 100 }],
      }),
    ]);
    expect(r1.balance).toBe(2000 - 400 - 300 - 999 - 100);
    expect(r1.bankPending).toBe(999);
  });

  it("同一列多筆轉數快加總並扣尾數", () => {
    const [r1] = computeRows([
      row("2026-01-01", {
        fuel: 3000,
        fpsEntries: [
          { id: "a", channel: "company", amount: 500 },
          { id: "b", channel: "private", amount: 200 },
          { id: "c", channel: "alipay", amount: 100 },
        ],
      }),
    ]);
    expect(r1.fpsCompany).toBe(500);
    expect(r1.fpsPrivate).toBe(200);
    expect(r1.fpsAlipay).toBe(100);
    expect(r1.balance).toBe(3000 - 800);
  });

  it("同一列多筆支出加總並扣尾數", () => {
    const [r1] = computeRows([
      row("2026-01-01", {
        fuel: 1000,
        expenseEntries: [
          { id: "a", label: "運輸", amount: 120 },
          { id: "b", label: "人工", amount: 80 },
        ],
      }),
    ]);
    expect(r1.expenses).toBe(200);
    expect(r1.balance).toBe(800);
  });
});

describe("computeTotals 月合計", () => {
  it("各欄加總且期末尾數為最後一列尾數", () => {
    const computed = computeRows([
      row("2026-01-01", { fuel: 100, water: 50 }),
      row("2026-01-02", {
        urea: 25,
        expenseEntries: [{ id: "e", label: "", amount: 40 }],
      }),
    ]);
    const totals = computeTotals(computed);
    expect(totals.fuel).toBe(100);
    expect(totals.water).toBe(50);
    expect(totals.urea).toBe(25);
    expect(totals.totalRevenue).toBe(100 + 50 + 25);
    expect(totals.expenses).toBe(40);
    expect(totals.closingBalance).toBe(computed.at(-1)!.balance);
    expect(totals.closingBalance).toBe(135);
  });
});

describe("normalizeRow 舊資料", () => {
  it("fpsChannel + fpsAmount 轉為 fpsEntries", () => {
    const r = normalizeRow({
      id: "1",
      date: "2026-01-01",
      fuel: 0,
      water: 0,
      urea: 0,
      fpsChannel: "private",
      fpsAmount: 120,
      bankDeposited: 0,
      bankPending: 0,
      cancelled: 0,
      expenses: 0,
      notes: { fpsAmount: "客戶 A" },
    });
    expect(r.fpsEntries).toHaveLength(1);
    expect(r.fpsEntries[0].channel).toBe("private");
    expect(r.fpsEntries[0].amount).toBe(120);
    expect(r.fpsEntries[0].note).toBe("客戶 A");
  });

  it("JSON 往返保留 fpsEntries / expenseEntries（與 migration jsonb 存法一致）", () => {
    const original = row("2026-10-01", {
      fuel: 200,
      water: 200,
      urea: 300,
      fpsEntries: [
        { id: "f1", channel: "company", amount: 200 },
        { id: "f2", channel: "private", amount: 200 },
      ],
      bankDeposited: 200,
      bankPending: 100,
      cancelled: 5,
      expenseEntries: [{ id: "e1", label: "abc", amount: 95 }],
    });
    const viaDb = normalizeRow(
      JSON.parse(JSON.stringify(original)) as Record<string, unknown>,
    );
    expect(viaDb.fpsEntries).toEqual(original.fpsEntries);
    expect(viaDb.expenseEntries).toEqual(original.expenseEntries);
    expect(viaDb.bankDeposited).toBe(200);
    expect(viaDb.cancelled).toBe(5);
  });

  it("單一 expenses 轉為 expenseEntries", () => {
    const r = normalizeRow({
      id: "1",
      date: "2026-01-01",
      fuel: 0,
      water: 0,
      urea: 0,
      fpsEntries: [],
      bankDeposited: 0,
      bankPending: 0,
      cancelled: 0,
      expenses: 250,
      notes: { expenses: "加油卡" },
    });
    expect(r.expenseEntries).toHaveLength(1);
    expect(r.expenseEntries[0].amount).toBe(250);
    expect(r.expenseEntries[0].note).toBe("加油卡");
  });
});
