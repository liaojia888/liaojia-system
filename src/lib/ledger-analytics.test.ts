import { describe, expect, it } from "vitest";
import { computeRows, computeTotals, createEmptyRow } from "@/lib/daily-ledger";
import {
  buildDailyRevenueTrend,
  formatReportRangeLabel,
  revenueChangePercent,
  summarizeRows,
} from "@/lib/ledger-analytics";

describe("summarizeRows 與日結核心一致", () => {
  it("月結摘要數字等同 computeTotals", () => {
    const rows = [
      { ...createEmptyRow("2026-03-01"), id: "a", fuel: 3000 },
      {
        ...createEmptyRow("2026-03-02"),
        id: "b",
        fuel: 500,
        expenseEntries: [{ id: "ex", label: "", amount: 800 }],
      },
    ];
    const { totals } = summarizeRows(rows);
    const expected = computeTotals(computeRows(rows));
    expect(totals.totalRevenue).toBe(expected.totalRevenue);
    expect(totals.closingBalance).toBe(expected.closingBalance);
    expect(totals.closingBalance).toBe(2700);
  });
});

describe("buildDailyRevenueTrend", () => {
  it("區間內逐日填 0，含無列日期", () => {
    const rows = [
      { ...createEmptyRow("2026-03-01"), id: "a", fuel: 1000 },
      { ...createEmptyRow("2026-03-03"), id: "b", fuel: 2000 },
    ];
    const points = buildDailyRevenueTrend(rows, {
      start: "2026-03-01",
      end: "2026-03-03",
    });
    expect(points).toHaveLength(3);
    expect(points[1].totalRevenue).toBe(0);
    expect(points[2].totalRevenue).toBe(2000);
  });
});

describe("formatReportRangeLabel", () => {
  it("整月回傳 null", () => {
    expect(
      formatReportRangeLabel("2026-03-01", "2026-03-31", {
        start: "2026-03-01",
        end: "2026-03-31",
      }),
    ).toBeNull();
  });
});

describe("revenueChangePercent", () => {
  it("計算環比", () => {
    expect(revenueChangePercent(110, 100)).toBeCloseTo(10);
  });
});
