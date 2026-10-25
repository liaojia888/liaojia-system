import type { SupabaseClient } from "@supabase/supabase-js";

export type LedgerChangeAction = "save" | "import";

const SAVE_LOG_COOLDOWN_MS = 15 * 60 * 1000;

export async function appendLedgerChangeLog(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    monthKey: string;
    userId: string;
    action: LedgerChangeAction;
    rowCount?: number;
  },
): Promise<void> {
  if (input.action === "save") {
    const since = new Date(Date.now() - SAVE_LOG_COOLDOWN_MS).toISOString();
    const { data: recent } = await supabase
      .from("daily_ledger_change_log")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("month_key", input.monthKey)
      .eq("changed_by", input.userId)
      .eq("action", "save")
      .gte("created_at", since)
      .limit(1);

    if (recent?.length) return;
  }

  await supabase.from("daily_ledger_change_log").insert({
    organization_id: input.organizationId,
    month_key: input.monthKey,
    changed_by: input.userId,
    action: input.action,
    row_count: input.rowCount ?? null,
  });
}
