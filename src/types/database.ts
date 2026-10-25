export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense";

export type Organization = {
  id: string;
  name: string;
  fiscal_year_start_month: number;
  created_at: string;
};

export type DailyLedgerMonth = {
  id: string;
  organization_id: string;
  month_key: string;
  rows: unknown;
  updated_at: string;
  updated_by: string | null;
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: "資產",
  liability: "負債",
  equity: "權益",
  revenue: "收入",
  expense: "費用",
};

/** 註冊／建立公司時寫入 Supabase accounts（傳票 UI 已移除，表仍保留供第二階段） */
export const DEFAULT_ACCOUNTS: {
  code: string;
  name: string;
  type: AccountType;
}[] = [
  { code: "1100", name: "現金", type: "asset" },
  { code: "1200", name: "銀行存款", type: "asset" },
  { code: "1300", name: "應收帳款", type: "asset" },
  { code: "2100", name: "應付帳款", type: "liability" },
  { code: "3100", name: "資本", type: "equity" },
  { code: "4100", name: "銷貨收入", type: "revenue" },
  { code: "5100", name: "銷貨成本", type: "expense" },
  { code: "5200", name: "薪資費用", type: "expense" },
  { code: "5300", name: "租金費用", type: "expense" },
];
