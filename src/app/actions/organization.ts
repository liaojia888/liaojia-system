"use server";

import { revalidatePath } from "next/cache";
import {
  ensureOrganizationForUser,
  getActiveOrganizationId,
} from "@/lib/organization";
import { createClient } from "@/lib/supabase/server";

export async function ensureOrganizationAction(defaultName: string) {
  const result = await ensureOrganizationForUser(defaultName.trim() || "我的公司");
  if (result.organizationId) {
    revalidatePath("/", "layout");
  }
  return result;
}

export async function updateOrganizationName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "公司名稱不可為空", name: null as string | null };
  }
  if (trimmed.length > 80) {
    return { error: "名稱請在 80 字以內", name: null as string | null };
  }

  const organizationId = await getActiveOrganizationId();
  if (!organizationId) {
    return { error: "找不到組織，請重新登入", name: null as string | null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name: trimmed })
    .eq("id", organizationId);

  if (error) {
    return { error: error.message, name: null as string | null };
  }

  revalidatePath("/", "layout");
  return { error: null, name: trimmed };
}
