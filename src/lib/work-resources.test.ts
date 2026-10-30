import { describe, expect, it } from "vitest";
import {
  computeWorkResourceMonthTotals,
  computeWorkResourceRows,
  createEmptyWorkResourceRow,
  normalizeWorkResourceRow,
  workResourceDailyNet,
} from "@/lib/work-resources";

describe("workResourceDailyNet", () => {
  it("大機+細機−試槍−漏油", () => {
    const row = createEmptyWorkResourceRow("2026-01-01");
    row.counts = {
      largeMachine: 10,
      smallMachine: 5,
      testGun: 3,
      oilLeak: 2,
    };
    expect(workResourceDailyNet(row)).toBe(10);
  });
});

describe("computeWorkResourceRows", () => {
  it("逐日累計", () => {
    const a = createEmptyWorkResourceRow("2026-01-01");
    a.counts.largeMachine = 4;
    const b = createEmptyWorkResourceRow("2026-01-02");
    b.counts.testGun = 1;
    const computed = computeWorkResourceRows([b, a]);
    expect(computed[0].dailyNet).toBe(4);
    expect(computed[0].cumulative).toBe(4);
    expect(computed[1].dailyNet).toBe(-1);
    expect(computed[1].cumulative).toBe(3);
    const totals = computeWorkResourceMonthTotals(computed);
    expect(totals.totalDailyNet).toBe(3);
    expect(totals.closingCumulative).toBe(3);
  });
});

describe("normalizeWorkResourceRow", () => {
  it("legacy flows 轉為 counts", () => {
    const row = normalizeWorkResourceRow({
      id: "x",
      date: "2026-01-01",
      flows: {
        largeMachine: { in: 5, out: 2 },
        smallMachine: { in: 0, out: 0 },
        testGun: { in: 1, out: 0 },
        oilLeak: { in: 0, out: 0 },
      },
    });
    expect(row.counts.largeMachine).toBe(3);
    expect(row.counts.testGun).toBe(1);
  });
});
