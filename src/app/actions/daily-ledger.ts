"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrEnsureOrganizationId } from "@/lib/organization";
import { normalizeRow, type DailyLedgerRow } from "@/lib/daily-ledger";
import { appendLedgerChangeLog } from "@/lib/ledger-audit";

export type LedgerMonthPayload = {
  rows: DailyLedgerRow[];
  updatedAt: string;
};

function parseRows(raw: unknown): DailyLedgerRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => normalizeRow(r as Record<string, unknown>));
}

export async function fetchLedgerMonth(
  monthKey: string,
): Promise<
  | { ok: true; data: LedgerMonthPayload | null }
  | { ok: false; error: string }
> {
  const { organizationId, error: orgError } =
    await getOrEnsureOrganizationId();
  if (!organizationId) {
    return {
      ok: false,
      error: orgError ?? "尚未建立公司，無法讀取 Supabase 日結。",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_ledger_months")
    .select("rows, updated_at")
    .eq("organization_id", organizationId)
    .eq("month_key", monthKey)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: true, data: null };
  }

  return {
    ok: true,
    data: {
      rows: parseRows(data.rows),
      updatedAt: data.updated_at as string,
    },
  };
}

export async function saveLedgerMonth(
  monthKey: string,
  rows: DailyLedgerRow[],
  expectedUpdatedAt: string | null,
  options?: { skipAudit?: boolean },
): Promise<
  | { ok: true; updatedAt: string }
  | { ok: false; error: string; conflict?: LedgerMonthPayload }
> {
  const { organizationId, error: orgError } =
    await getOrEnsureOrganizationId();
  if (!organizationId) {
    return {
      ok: false,
      error: orgError ?? "尚未建立公司，無法寫入 Supabase。",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "請先登入。" };
  }

  const now = new Date().toISOString();

  if (expectedUpdatedAt) {
    const { data, error } = await supabase
      .from("daily_ledger_months")
      .update({
        rows,
        updated_at: now,
        updated_by: user.id,
      })
      .eq("organization_id", organizationId)
      .eq("month_key", monthKey)
      .eq("updated_at", expectedUpdatedAt)
      .select("updated_at")
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data) {
      const current = await fetchLedgerMonth(monthKey);
      if (current.ok && current.data) {
        return {
          ok: false,
          error: "Supabase 已有較新版本，請重新載入後再編輯。",
          conflict: current.data,
        };
      }
      return { ok: false, error: "儲存衝突，請重新載入頁面。" };
    }

    if (!options?.skipAudit) {
      await appendLedgerChangeLog(supabase, {
        organizationId,
        monthKey,
        userId: user.id,
        action: "save",
        rowCount: rows.length,
      });
    }

    return { ok: true, updatedAt: data.updated_at as string };
  }

  const { data, error } = await supabase
    .from("daily_ledger_months")
    .upsert(
      {
        organization_id: organizationId,
        month_key: monthKey,
        rows,
        updated_at: now,
        updated_by: user.id,
      },
      { onConflict: "organization_id,month_key" },
    )
    .select("updated_at")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!options?.skipAudit) {
    await appendLedgerChangeLog(supabase, {
      organizationId,
      monthKey,
      userId: user.id,
      action: "save",
      rowCount: rows.length,
    });
  }

  return { ok: true, updatedAt: data.updated_at as string };
}

export type LedgerChangeLogEntry = {
  id: string;
  monthKey: string;
  action: "save" | "import";
  rowCount: number | null;
  createdAt: string;
  changedBy: string | null;
  actorName: string | null;
};

export async function fetchLedgerChangeLogs(options?: {
  limit?: number;
  /** ISO：含當日 00:00:00（本機時區換算後傳入） */
  createdAfter?: string;
  /** ISO：含當日 23:59:59.999（本機時區換算後傳入） */
  createdBefore?: string;
}): Promise<
  | { ok: true; entries: LedgerChangeLogEntry[] }
  | { ok: false; error: string }
> {
  const limit = options?.limit ?? 100;
  const { organizationId, error: orgError } =
    await getOrEnsureOrganizationId();
  if (!organizationId) {
    return { ok: false, error: orgError ?? "尚未建立公司。" };
  }

  const supabase = await createClient();
  let query = supabase
    .from("daily_ledger_change_log")
    .select(
      `
      id,
      month_key,
      action,
      row_count,
      created_at,
      changed_by,
      profiles:changed_by ( full_name )
    `,
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.createdAfter) {
    query = query.gte("created_at", options.createdAfter);
  }
  if (options?.createdBefore) {
    query = query.lte("created_at", options.createdBefore);
  }

  const { data, error } = await query;

  if (error) {
    return { ok: false, error: error.message };
  }

  const entries: LedgerChangeLogEntry[] = (data ?? []).map((row) => {
    const rawProfile = row.profiles as
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
    const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
    return {
      id: row.id as string,
      monthKey: row.month_key as string,
      action: row.action as "save" | "import",
      rowCount: row.row_count as number | null,
      createdAt: row.created_at as string,
      changedBy: row.changed_by as string | null,
      actorName: profile?.full_name?.trim() || null,
    };
  });

  return { ok: true, entries };
}

export async function fetchAllLedgerMonths(): Promise<
  | { ok: true; months: Record<string, LedgerMonthPayload> }
  | { ok: false; error: string }
> {
  const { organizationId, error: orgError } =
    await getOrEnsureOrganizationId();
  if (!organizationId) {
    return { ok: false, error: orgError ?? "尚未建立公司。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_ledger_months")
    .select("month_key, rows, updated_at")
    .eq("organization_id", organizationId)
    .order("month_key");

  if (error) {
    return { ok: false, error: error.message };
  }

  const months: Record<string, LedgerMonthPayload> = {};
  for (const row of data ?? []) {
    months[row.month_key as string] = {
      rows: parseRows(row.rows),
      updatedAt: row.updated_at as string,
    };
  }

  return { ok: true, months };
}

export async function importLedgerBackup(
  months: Record<string, DailyLedgerRow[]>,
): Promise<{ ok: true; imported: number } | { ok: false; error: string }> {
  const { organizationId, error: orgError } =
    await getOrEnsureOrganizationId();
  if (!organizationId) {
    return { ok: false, error: orgError ?? "尚未建立公司。" };
  }

  let imported = 0;
  for (const [monthKey, rows] of Object.entries(months)) {
    if (!/^\d{4}-\d{2}$/.test(monthKey) || !rows?.length) continue;
    const result = await saveLedgerMonth(monthKey, rows, null, {
      skipAudit: true,
    });
    if (result.ok) {
      imported += 1;
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await appendLedgerChangeLog(supabase, {
          organizationId,
          monthKey,
          userId: user.id,
          action: "import",
          rowCount: rows.length,
        });
      }
    } else return { ok: false, error: result.error };
  }

  return { ok: true, imported };
}
