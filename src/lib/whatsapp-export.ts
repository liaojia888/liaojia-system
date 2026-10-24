import {
  FPS_CHANNEL_OPTIONS,
  isLedgerRowActive,
  type DailyLedgerComputed,
  type DailyLedgerTotals,
  type FpsChannel,
} from "@/lib/daily-ledger";

function money(n: number): string {
  return n.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

function fpsLabel(channel: FpsChannel): string {
  return FPS_CHANNEL_OPTIONS.find((o) => o.value === channel)?.label ?? "—";
}

function formatDateZh(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${y}/${m}/${d}`;
}

function appendNotesBlock(row: DailyLedgerComputed): string {
  const entries = Object.entries(row.notes ?? {}).filter(([, v]) => v?.trim());
  if (!entries.length) return "";
  const lines = entries.map(([key, text]) => `  · ${noteKeyLabel(key)}：${text}`);
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

export function formatLedgerRowForWhatsApp(
  row: DailyLedgerComputed,
  companyName: string,
): string {
  const balanceLine = isLedgerRowActive(row)
    ? `\n尾數：${money(row.balance)}`
    : "";

  return [
    `【日結單列】${companyName}`,
    `日期：${formatDateZh(row.date)}`,
    "",
    `油收入：${money(row.fuel)}`,
    `水收入：${money(row.water)}`,
    `尿素收入：${money(row.urea)}`,
    `品項小計：${money(row.productSubtotal)}`,
    "",
    `轉數快：${fpsLabel(row.fpsChannel)} ${money(row.fpsAmount)}`,
    `已入銀行（公司）：${money(row.bankDeposited)}`,
    `待入銀行（公司）：${money(row.bankPending)}`,
    `撤單：${money(row.cancelled)}`,
    `支出：${money(row.expenses)}`,
    balanceLine,
    appendNotesBlock(row),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
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
            return [
              `▸ ${formatDateZh(row.date)}`,
              `  油/水/尿素：${money(row.fuel)}/${money(row.water)}/${money(row.urea)}`,
              `  轉數快 ${fpsLabel(row.fpsChannel)}：${money(row.fpsAmount)} | 入銀：${money(row.bankDeposited)} | 待入：${money(row.bankPending)}`,
              `  撤單：${money(row.cancelled)} | 支出：${money(row.expenses)} | 尾數：${money(row.balance)}`,
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

const WHATSAPP_MAX_TEXT = 3500;

export function openWhatsAppShare(text: string): { ok: boolean; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "沒有可匯出的內容" };
  }
  if (trimmed.length > WHATSAPP_MAX_TEXT) {
    return {
      ok: false,
      error: "內容過長，請改用「匯出此列」或減少列數後再試",
    };
  }

  const url = `https://wa.me/?text=${encodeURIComponent(trimmed)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  return { ok: true };
}
