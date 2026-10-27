export const LEDGER_LAYOUT_STORAGE_KEY = "accounting-ledger-layout";
export const LEDGER_LAYOUT_USER_META_KEY = "ledger_layout";

export type LedgerLayoutId = "spreadsheet" | "workbench";

export type LedgerLayoutOption = {
  id: LedgerLayoutId;
  name: string;
  description: string;
  /** 簡短預覽標籤 */
  tags: string[];
};

export const LEDGER_LAYOUT_OPTIONS: LedgerLayoutOption[] = [
  {
    id: "spreadsheet",
    name: "試算表視圖",
    description: "寬表格一次看整月，適合大螢幕對帳與列印思維。",
    tags: ["桌面表格", "多欄並排"],
  },
  {
    id: "workbench",
    name: "工作台視圖",
    description: "以「每日卡片」編輯，工具列精簡，手機與平板較好操作。",
    tags: ["卡片逐日", "精簡頁首"],
  },
];

export const DEFAULT_LEDGER_LAYOUT: LedgerLayoutId = "spreadsheet";

export function isLedgerLayoutId(value: string): value is LedgerLayoutId {
  return LEDGER_LAYOUT_OPTIONS.some((o) => o.id === value);
}

export function layoutFromUserMetadata(
  metadata: Record<string, unknown> | undefined,
): LedgerLayoutId | null {
  const raw = metadata?.[LEDGER_LAYOUT_USER_META_KEY];
  if (typeof raw === "string" && isLedgerLayoutId(raw)) return raw;
  return null;
}

export function readStoredLedgerLayout(): LedgerLayoutId {
  if (typeof window === "undefined") return DEFAULT_LEDGER_LAYOUT;
  try {
    const raw = localStorage.getItem(LEDGER_LAYOUT_STORAGE_KEY);
    if (raw && isLedgerLayoutId(raw)) return raw;
  } catch {
    // ignore
  }
  return DEFAULT_LEDGER_LAYOUT;
}

export function writeStoredLedgerLayout(layout: LedgerLayoutId) {
  try {
    localStorage.setItem(LEDGER_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // ignore
  }
}
