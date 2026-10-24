"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/organization";
import type { AccountType } from "@/types/database";

export async function createAccount(
  _prev: { error: string | null } | undefined,
  formData: FormData,
) {
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) {
    return { error: "找不到組織，請重新登入或完成註冊" };
  }

  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as AccountType;

  if (!code || !name || !type) {
    return { error: "請填寫科目代碼、名稱與類型" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").insert({
    organization_id: organizationId,
    code,
    name,
    type,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/accounts");
  return { error: null };
}
