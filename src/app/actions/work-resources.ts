"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrEnsureOrganizationId } from "@/lib/organization";
import {
  normalizeWorkResourceRow,
  type WorkResourceRow,
} from "@/lib/work-resources";

export type WorkResourceMonthPayload = {
  rows: WorkResourceRow[];
  updatedAt: string;
};

function parseRows(raw: unknown): WorkResourceRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) =>
    normalizeWorkResourceRow(r as Record<string, unknown>),
  );
}

export async function fetchWorkResourceMonth(
  monthKey: string,
): Promise<
  | { ok: true; data: WorkResourceMonthPayload | null }
  | { ok: false; error: string }
> {
  const { organizationId, error: orgError } =
    await getOrEnsureOrganizationId();
  if (!organizationId) {
    return {
      ok: false,
      error: orgError ?? "尚未建立公司，無法讀取 Supabase。",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_resource_months")
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

export async function saveWorkResourceMonth(
  monthKey: string,
  rows: WorkResourceRow[],
  expectedUpdatedAt: string | null,
): Promise<
  | { ok: true; updatedAt: string }
  | { ok: false; error: string; conflict?: WorkResourceMonthPayload }
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
      .from("work_resource_months")
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
      const conflict = await fetchWorkResourceMonth(monthKey);
      if (conflict.ok && conflict.data) {
        return {
          ok: false,
          error: "雲端已有較新版本，請先更新或合併。",
          conflict: conflict.data,
        };
      }
      return { ok: false, error: "儲存失敗（版本衝突）。" };
    }

    return { ok: true, updatedAt: data.updated_at as string };
  }

  const { data, error } = await supabase
    .from("work_resource_months")
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

  return { ok: true, updatedAt: data.updated_at as string };
}
