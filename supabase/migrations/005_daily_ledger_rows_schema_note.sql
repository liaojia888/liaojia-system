-- 說明：daily_ledger_months.rows 為 JSONB 陣列，非逐欄 migration。
-- 每列物件由應用程式定義（見 src/lib/daily-ledger.ts DailyLedgerRow），
-- 含 fuel, water, urea, fpsEntries[], bankDeposited, bankPending, cancelled,
-- expenseEntries[], notes 等；舊版 fpsChannel/fpsAmount、expenses 讀取時由 normalizeRow 轉換。
-- 若 Supabase 內只看到油水尿素而無 fpsEntries，代表寫入當下 JSON 即不完整，非資料表缺欄。

comment on column public.daily_ledger_months.rows is
  'Daily ledger rows JSON array (DailyLedgerRow). Full document stored as-is; not normalized by Postgres.';
