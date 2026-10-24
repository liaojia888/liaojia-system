"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/organization";

type LineInput = {
  accountId: string;
  debit: number;
  credit: number;
  memo?: string;
};

export async function createJournalEntry(
  _prev: { error: string | null } | undefined,
  formData: FormData,
) {
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) {
    return { error: "找不到組織" };
  }

  const entryDate = String(formData.get("entryDate") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const linesJson = String(formData.get("lines") ?? "[]");

  let lines: LineInput[];
  try {
    lines = JSON.parse(linesJson) as LineInput[];
  } catch {
    return { error: "分錄格式錯誤" };
  }

  if (!entryDate || !description) {
    return { error: "請填寫日期與摘要" };
  }

  const activeLines = lines.filter(
    (l) => l.accountId && (l.debit > 0 || l.credit > 0),
  );
  if (activeLines.length < 2) {
    return { error: "至少需要兩筆有效分錄" };
  }

  const totalDebit = activeLines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = activeLines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return { error: "借貸不平衡，無法儲存" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: entry, error: entryError } = await supabase
    .from("journal_entries")
    .insert({
      organization_id: organizationId,
      entry_date: entryDate,
      description,
      reference,
      status: "draft",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    return { error: entryError?.message ?? "無法建立傳票" };
  }

  const { error: linesError } = await supabase.from("journal_lines").insert(
    activeLines.map((line, index) => ({
      entry_id: entry.id,
      account_id: line.accountId,
      debit: line.debit,
      credit: line.credit,
      memo: line.memo ?? null,
      line_order: index,
    })),
  );

  if (linesError) {
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    return { error: linesError.message };
  }

  revalidatePath("/journal");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function postJournalEntry(entryId: string) {
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) {
    return { error: "找不到組織" };
  }

  const supabase = await createClient();

  const { data: entry } = await supabase
    .from("journal_entries")
    .select("id, status, journal_lines(debit, credit)")
    .eq("id", entryId)
    .eq("organization_id", organizationId)
    .single();

  if (!entry) {
    return { error: "找不到傳票" };
  }
  if (entry.status === "posted") {
    return { error: "傳票已過帳" };
  }

  const lines = entry.journal_lines as { debit: number; credit: number }[];
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return { error: "借貸不平衡，無法過帳" };
  }

  const { error } = await supabase
    .from("journal_entries")
    .update({ status: "posted", posted_at: new Date().toISOString() })
    .eq("id", entryId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/journal");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  return { error: null };
}
