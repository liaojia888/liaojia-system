import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ACCOUNTS } from "@/types/database";

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

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: orgName.trim() })
    .select("id")
    .single();

  if (orgError || !org) {
    return {
      organizationId: null,
      error: orgError?.message ?? "無法建立組織",
    };
  }

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: "owner",
    });

  if (memberError) {
    return { organizationId: null, error: memberError.message };
  }

  const { error: accountsError } = await supabase.from("accounts").insert(
    DEFAULT_ACCOUNTS.map((a) => ({
      organization_id: org.id,
      code: a.code,
      name: a.name,
      type: a.type,
    })),
  );

  if (accountsError) {
    return { organizationId: org.id, error: accountsError.message };
  }

  return { organizationId: org.id, error: null };
}
