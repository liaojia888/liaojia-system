import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/organization";
import type { Organization } from "@/types/database";

export async function getOrganizationContext(): Promise<{
  organization: Organization | null;
  organizationId: string | null;
}> {
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) {
    return { organization: null, organizationId: null };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .single();

  return { organization: data as Organization | null, organizationId };
}
