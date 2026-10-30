import {
  formatExpenseEntriesSummary,
  formatFpsEntriesSummary,
  fpsLabel,
  isExpenseEntryCounted,
  isFpsEntryCounted,
  isLedgerRowActive,
  type DailyLedgerComputed,
  type DailyLedgerTotals,
} from "@/lib/daily-ledger";
import {
  WORK_RESOURCE_CATEGORIES,
  workResourceRowHasData,
  type WorkResourceComputedRow,
  type WorkResourceMonthTotals,
} from "@/lib/work-resources";

function money(n: number): string {
  return n.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

function formatDateZh(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${y}/${m}/${d}`;
}

function appendNotesBlock(row: DailyLedgerComputed): string {
  const lines: string[] = [];
  for (const entry of row.fpsEntries) {
    if (entry.note?.trim()) {
      lines.push(
        `  · 轉數快 ${fpsLabel(entry.channel)}：${entry.note.trim()}`,
      );
    }
  }
  for (const entry of row.expenseEntries) {
    if (entry.note?.trim()) {
      const head = entry.label.trim() || "支出";
      lines.push(`  · ${head}：${entry.note.trim()}`);
    }
  }
  const entries = Object.entries(row.notes ?? {}).filter(([, v]) => v?.trim());
  for (const [key, text] of entries) {
    lines.push(`  · ${noteKeyLabel(key)}：${text}`);
  }
  if (!lines.length) return "";
  return `\n備註：\n${lines.join("\n")}`;
}

function noteKeyLabel(key: string): string {
  const map: Record<string, string> = {
    fuel: "油",
    water: "水",
    urea: "尿素",
    fpsAmount: "轉數快",
    bankDeposited: "已入銀行",
    bankPending: "待入銀行",
    cancelled: "撤單",
    expenses: "支出",
  };
  return map[key] ?? key;
}

function formatExpenseBlock(row: DailyLedgerComputed): string {
  const active = row.expenseEntries.filter(isExpenseEntryCounted);
  if (!active.length) return "支出：—";
  if (active.length === 1) {
    const e = active[0];
    const head = e.label.trim() ? e.label.trim() : "支出";
    return `支出：${head} ${money(e.amount)}`;
  }
  return `支出：\n${active
    .map((e) => {
      const head = e.label.trim() ? e.label.trim() : "支出";
      return `  · ${head} ${money(e.amount)}`;
    })
    .join("\n")}`;
}

function formatFpsBlock(row: DailyLedgerComputed): string {
  const active = row.fpsEntries.filter(isFpsEntryCounted);
  if (!active.length) return "轉數快：—";
  if (active.length === 1) {
    const e = active[0];
    return `轉數快：${fpsLabel(e.channel)} ${money(e.amount)}`;
  }
  return `轉數快：\n${active
    .map((e) => `  · ${fpsLabel(e.channel)} ${money(e.amount)}`)
    .join("\n")}`;
}

export function formatLedgerRowForWhatsApp(
  row: DailyLedgerComputed,
  companyName: string,
): string {
  const balanceLine = isLedgerRowActive(row)
    ? `\n當日尾數：${money(row.dailyBalance)}`
    : "";

  return [
    `【日結單列】${companyName}`,
    `日期：${formatDateZh(row.date)}`,
    "",
    `油收入：${money(row.fuel)}`,
    `水收入：${money(row.water)}`,
    `尿素收入：${money(row.urea)}`,
    `總收入：${money(row.productSubtotal)}`,
    "",
    formatFpsBlock(row),
    `已入銀行（公司）：${money(row.bankDeposited)}`,
    `待入銀行（公司）：${money(row.bankPending)}`,
    `撤單：${money(row.cancelled)}`,
    formatExpenseBlock(row),
    balanceLine,
    appendNotesBlock(row),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function formatLedgerYearForWhatsApp(
  summaries: {
    month: number;
    hasData: boolean;
    totals: DailyLedgerTotals;
  }[],
  yearTotals: DailyLedgerTotals,
  year: number,
  companyName: string,
): string {
  const monthLines = summaries
    .filter((s) => s.hasData)
    .map(
      (s) =>
        `${s.month}月 淨收 ${money(s.totals.totalRevenue)} | 支出 ${money(s.totals.expenses)} | 尾數 ${money(s.totals.closingBalance)}`,
    )
    .join("\n");

  return [
    `【${year}年 日結年度摘要】${companyName}`,
    "",
    monthLines || "（本年尚無資料）",
    "",
    "— 年度合計 —",
    `淨收入：${money(yearTotals.totalRevenue)}`,
    `支出：${money(yearTotals.expenses)}`,
    `期末尾數：${money(yearTotals.closingBalance)}（取最後有資料月份）`,
  ].join("\n");
}

export function formatLedgerMonthForWhatsApp(
  rows: DailyLedgerComputed[],
  totals: DailyLedgerTotals,
  year: number,
  month: number,
  companyName: string,
): string {
  const activeRows = rows.filter(isLedgerRowActive);
  const rowBlocks =
    activeRows.length === 0
      ? "（本月尚無填寫資料）"
      : activeRows
          .map((row) => {
            const fps = formatFpsEntriesSummary(row.fpsEntries) || "—";
            const exp =
              formatExpenseEntriesSummary(row.expenseEntries) || "—";
            return [
              `▸ ${formatDateZh(row.date)}`,
              `  油/水/尿素：${money(row.fuel)}/${money(row.water)}/${money(row.urea)}`,
              `  轉數快 ${fps} | 入銀：${money(row.bankDeposited)} | 待入：${money(row.bankPending)}`,
              `  撤單：${money(row.cancelled)} | 支出 ${exp} | 當日尾數：${money(row.dailyBalance)}`,
            ].join("\n");
          })
          .join("\n");

  return [
    `【${year}年${month}月 日結摘要】${companyName}`,
    "",
    rowBlocks,
    "",
    "— 本月合計 —",
    `油：${money(totals.fuel)} | 水：${money(totals.water)} | 尿素：${money(totals.urea)}`,
    `總收入：${money(totals.totalRevenue)}`,
    `轉數快 公司/私人/Alipay：${money(totals.fpsCompany)}/${money(totals.fpsPrivate)}/${money(totals.fpsAlipay)}`,
    `已入銀行：${money(totals.bankDeposited)} | 待入銀行：${money(totals.bankPending)}`,
    `支出：${money(totals.expenses)} | 期末尾數：${money(totals.closingBalance)}`,
  ].join("\n");
}

const SHARE_MAX_TEXT = 3500;

export type ShareTextResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export function prepareShareText(text: string): ShareTextResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "沒有可匯出的內容" };
  }
  if (trimmed.length > SHARE_MAX_TEXT) {
    return {
      ok: false,
      error: "內容過長，請改用「匯出此列」或減少列數後再試",
    };
  }
  return { ok: true, text: trimmed };
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) throw new Error("copy failed");
}

export function openWhatsAppShare(text: string): { ok: boolean; error?: string } {
  const prepared = prepareShareText(text);
  if (!prepared.ok) return prepared;

  const url = `https://wa.me/?text=${encodeURIComponent(prepared.text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  return { ok: true };
}

export type WeChatShareResult = {
  ok: boolean;
  error?: string;
  /** 與 WhatsApp 相同之純文字；一律複製到剪貼簿後到微信貼上 */
  mode?: "clipboard";
};

/**
 * 微信沒有像 WhatsApp 的 wa.me/?text= 帶文連結；
 * Web Share 在微信常變成連結卡片或截圖，故一律複製純文字。
 */
export async function shareViaWeChat(text: string): Promise<WeChatShareResult> {
  const prepared = prepareShareText(text);
  if (!prepared.ok) return prepared;

  try {
    await copyTextToClipboard(prepared.text);
    return { ok: true, mode: "clipboard" };
  } catch {
    return { ok: false, error: "無法複製到剪貼簿，請改用 WhatsApp 或 CSV 匯出" };
  }
}

export function weChatShareSuccessMessage(
  _mode?: WeChatShareResult["mode"],
): string {
  return "文字已複製（與 WhatsApp 相同格式）。請開啟微信 → 選聊天 → 長按輸入框貼上。";
}

export function formatWorkResourceRowForWhatsApp(
  row: WorkResourceComputedRow,
  companyName: string,
): string {
  const lines = WORK_RESOURCE_CATEGORIES.map(
    ({ key, label }) => `${label}：${money(row.counts[key])}`,
  );
  const noteBlock = row.note.trim()
    ? `\n備註：${row.note.trim()}`
    : "";
  return [
    `【資源進出】${companyName}`,
    `日期：${formatDateZh(row.date)}`,
    "",
    ...lines,
    "",
    `當日用量：${money(row.dailyNet)}（大機+細機−試槍−漏油）`,
    noteBlock,
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function formatWorkResourceMonthForWhatsApp(
  rows: WorkResourceComputedRow[],
  totals: WorkResourceMonthTotals,
  year: number,
  month: number,
  companyName: string,
): string {
  const activeRows = rows.filter(workResourceRowHasData);
  const rowBlocks =
    activeRows.length === 0
      ? "（本月尚無填寫資料）"
      : activeRows
          .map((row) => {
            const parts = WORK_RESOURCE_CATEGORIES.map(
              ({ key, label }) => `${label}${money(row.counts[key])}`,
            ).join(" ");
            return `▸ ${formatDateZh(row.date)} ${parts} | 用量${money(row.dailyNet)}`;
          })
          .join("\n");

  const catTotals = WORK_RESOURCE_CATEGORIES.map(
    ({ key, label }) => `${label}：${money(totals[key])}`,
  ).join(" | ");

  return [
    `【${year}年${month}月 資源進出摘要】${companyName}`,
    "",
    rowBlocks,
    "",
    "— 本月合計 —",
    catTotals,
    `本月用量加總：${money(totals.totalDailyNet)}`,
  ].join("\n");
}
