import { test, expect } from "@playwright/test";
import {
  computeRows,
  computeTotals,
  sortRowsByDate,
} from "../src/lib/daily-ledger";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("登入 → 日結一列 → 月結數字一致", () => {
  test.skip(
    !email || !password,
    "請設定 E2E_EMAIL 與 E2E_PASSWORD（建議使用測試專用帳號）",
  );

  test("本機日結與月結摘要總收入、期末尾數相同", async ({ page }) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = String(month).padStart(2, "0");
    const day1 = `${year}-${monthStr}-01`;
    const monthKey = `${year}-${monthStr}`;

    const fuel = 8000;
    const expenses = 1500;
    const expectedTotals = computeTotals(
      computeRows(
        sortRowsByDate([
          {
            id: "e2e",
            date: day1,
            fuel,
            water: 0,
            urea: 0,
            fpsEntries: [],
            bankDeposited: 0,
            bankPending: 0,
            cancelled: 0,
            expenseEntries: [{ id: "e2e-ex", label: "", amount: expenses }],
            notes: {},
          },
        ]),
      ),
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("密碼").fill(password!);
    await page.getByRole("button", { name: "登入" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /年.*月/ })).toBeVisible();
    await page.waitForSelector(`[data-ledger-date="${day1}"]`, {
      timeout: 30_000,
    });

    await page.evaluate(
      ({ monthKey, day1, fuel, expenses }) => {
        const storageKey = "accounting-daily-ledger";
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const all = JSON.parse(raw) as Record<
          string,
          { monthKey: string; rows: Record<string, unknown>[] }
        >;
        const entry = all[monthKey];
        if (!entry?.rows?.length) return;

        for (const r of entry.rows) {
          r.fuel = 0;
          r.water = 0;
          r.urea = 0;
          r.fpsEntries = [];
          r.bankDeposited = 0;
          r.bankPending = 0;
          r.cancelled = 0;
          r.expenseEntries = [];
        }
        const target = entry.rows.find((r) => r.date === day1);
        if (target) {
          target.fuel = fuel;
          target.expenseEntries = [
            { id: "e2e-ex", label: "", amount: expenses },
          ];
          delete target.expenses;
        }
        localStorage.setItem(storageKey, JSON.stringify(all));
      },
      { monthKey, day1, fuel, expenses },
    );

    await page.reload();
    await page.waitForSelector(`[data-ledger-date="${day1}"]`);

    const fuelInput = page.locator(
      `[data-ledger-date="${day1}"] input[data-ledger-field="fuel"]`,
    );
    await fuelInput.click();
    await fuelInput.fill(String(fuel));
    await fuelInput.blur();

    await page
      .locator(`[data-ledger-date="${day1}"]`)
      .getByRole("button", { name: "＋ 支出" })
      .click();
    const expenseInput = page.locator(
      `[data-ledger-date="${day1}"] input[data-ledger-field="expenses"]`,
    );
    await expenseInput.click();
    await expenseInput.fill(String(expenses));
    await expenseInput.blur();

    await expect(
      page.locator(`[data-ledger-date="${day1}"]`).getByText(
        String(expectedTotals.closingBalance),
      ),
    ).toBeVisible({ timeout: 10_000 });

    await page.goto("/reports");
    await expect(page.getByText("月結摘要")).toBeVisible();

    const revenueEl = page.locator('[data-report-stat="總收入"]');
    const closingEl = page.locator('[data-report-stat="期末尾數"]');
    await expect(revenueEl).toBeVisible();
    await expect(closingEl).toBeVisible();

    const digits = (s: string) => s.replace(/[^\d]/g, "");

    expect(digits((await revenueEl.textContent()) ?? "")).toBe(
      String(expectedTotals.totalRevenue),
    );
    expect(digits((await closingEl.textContent()) ?? "")).toBe(
      String(expectedTotals.closingBalance),
    );
  });
});
