import { describe, expect, it } from "vitest";
import { createEmptyRow } from "@/lib/daily-ledger";
import {
  mergeMonthRowsPreferRicher,
  pickRicherRow,
} from "@/lib/ledger-row-merge";

describe("ledger-row-merge", () => {
  it("keeps row with fps/expense when other only has revenue", () => {
    const sparse = {
      ...createEmptyRow("2026-10-01"),
      fuel: 200,
      water: 200,
      urea: 300,
    };
    const full = {
      ...sparse,
      id: sparse.id,
      fpsEntries: [
        { id: "f1", channel: "company" as const, amount: 200 },
        { id: "f2", channel: "private" as const, amount: 200 },
      ],
      bankDeposited: 200,
      bankPending: 100,
      cancelled: 5,
      expenseEntries: [
        { id: "e1", label: "abc", amount: 95 },
      ],
    };

    expect(pickRicherRow(sparse, full)).toEqual(full);
    const merged = mergeMonthRowsPreferRicher([sparse], [full]);
    expect(merged[0].fpsEntries).toHaveLength(2);
    expect(merged[0].expenseEntries[0]?.amount).toBe(95);
  });
});
