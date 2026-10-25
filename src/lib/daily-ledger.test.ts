import { describe, expect, it } from "vitest";
import {
  computeRows,
  computeTotals,
  createEmptyRow,
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
      row("2026-01-02", { expenses: 300 }),
    ]);
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

  it("轉數快與已入銀行、支出減少尾數；待入銀行不扣尾數", () => {
    const [r1] = computeRows([
      row("2026-01-01", {
        fuel: 2000,
        fpsChannel: "company",
        fpsAmount: 400,
        bankDeposited: 300,
        bankPending: 999,
        expenses: 100,
      }),
    ]);
    expect(r1.balance).toBe(2000 - 400 - 300 - 100);
    expect(r1.bankPending).toBe(999);
  });
});

describe("computeTotals 月合計", () => {
  it("各欄加總且期末尾數為最後一列尾數", () => {
    const computed = computeRows([
      row("2026-01-01", { fuel: 100, water: 50 }),
      row("2026-01-02", { urea: 25, expenses: 40 }),
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
