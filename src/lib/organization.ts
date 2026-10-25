import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ACCOUNTS } from "@/types/database";

/** 取得組織 ID；若尚無成員記錄則自動建立公司（供雲端日結等使用） */
export async function getOrEnsureOrganizationId(
  defaultName = "我的公司",
): Promise<{ organizationId: string | null; error: string | null }> {
  const existing = await getActiveOrganizationId();
  if (existing) {
    return { organizationId: existing, error: null };
  }
  return ensureOrganizationForUser(defaultName);
}

export async function getActiveOrganizationId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return membership?.organization_id ?? null;
}

export async function ensureOrganizationForUser(
  orgName: string,
): Promise<{ organizationId: string | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { organizationId: null, error: "請先登入" };
  }

  const existing = await getActiveOrganizationId();
  if (existing) {
    return { organizationId: existing, error: null };
  }

  const { data: orgId, error: rpcError } = await supabase.rpc(
    "create_organization_for_user",
    { org_name: orgName.trim() || "我的公司" },
  );

  if (rpcError || !orgId) {
    return {
      organizationId: null,
      error:
        rpcError?.message ??
        "無法建立公司。請在 Supabase SQL Editor 執行 003_organization_create_rpc.sql。",
    };
  }

  const organizationId = orgId as string;

  const { count, error: countError } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (countError) {
    return { organizationId, error: countError.message };
  }

  if ((count ?? 0) === 0) {
    const { error: accountsError } = await supabase.from("accounts").insert(
      DEFAULT_ACCOUNTS.map((a) => ({
        organization_id: organizationId,
        code: a.code,
        name: a.name,
        type: a.type,
      })),
    );

    if (accountsError) {
      return { organizationId, error: accountsError.message };
    }
  }

  return { organizationId, error: null };
}
