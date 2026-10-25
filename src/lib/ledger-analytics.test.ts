import { describe, expect, it } from "vitest";
import { computeRows, computeTotals, createEmptyRow } from "@/lib/daily-ledger";
import { summarizeRows } from "@/lib/ledger-analytics";

describe("summarizeRows 與日結核心一致", () => {
  it("月結摘要數字等同 computeTotals", () => {
    const rows = [
      { ...createEmptyRow("2026-03-01"), id: "a", fuel: 3000 },
      { ...createEmptyRow("2026-03-02"), id: "b", fuel: 500, expenses: 800 },
    ];
    const { totals } = summarizeRows(rows);
    const expected = computeTotals(computeRows(rows));
    expect(totals.totalRevenue).toBe(expected.totalRevenue);
    expect(totals.closingBalance).toBe(expected.closingBalance);
    expect(totals.closingBalance).toBe(2700);
  });
});
