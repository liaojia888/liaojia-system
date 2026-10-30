import { describe, expect, it } from "vitest";
import { computeRows } from "@/lib/daily-ledger";
import { parseLedgerRowFromWhatsApp } from "@/lib/whatsapp-row-import";

const SAMPLE = `【日結單列】我的公司
日期：2026/10/01

油收入：200
水收入：200
尿素收入：300
總收入：700

轉數快：
  · 公司 200
  · 私人 200
已入銀行（公司）：200
待入銀行（公司）：100
撤單：5
支出：abc 95

尾數：0`;

describe("parseLedgerRowFromWhatsApp", () => {
  it("parses full row from WhatsApp export text", () => {
    const row = parseLedgerRowFromWhatsApp(SAMPLE);
    expect(row).not.toBeNull();
    expect(row!.date).toBe("2026-10-01");
    expect(row!.fuel).toBe(200);
    expect(row!.water).toBe(200);
    expect(row!.urea).toBe(300);
    expect(row!.bankDeposited).toBe(200);
    expect(row!.bankPending).toBe(100);
    expect(row!.cancelled).toBe(5);
    expect(row!.fpsEntries).toHaveLength(2);
    expect(row!.fpsEntries.map((e) => e.channel).sort()).toEqual([
      "company",
      "private",
    ]);
    expect(row!.expenseEntries).toHaveLength(1);
    expect(row!.expenseEntries[0].label).toBe("abc");
    expect(row!.expenseEntries[0].amount).toBe(95);

    const [computed] = computeRows([row!]);
    // 695 淨收入 − 轉數快 400 − 已入 200 − 待入 100 − 支出 95
    expect(computed.dailyBalance).toBe(-100);
    expect(computed.balance).toBe(-100);
  });
});
