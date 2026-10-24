import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/organization";
import type {
  Account,
  JournalEntryWithLines,
  Organization,
} from "@/types/database";

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

export async function listAccounts(): Promise<Account[]> {
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("code");

  return (data ?? []) as Account[];
}

export async function listJournalEntries(): Promise<JournalEntryWithLines[]> {
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_entries")
    .select(
      `
      *,
      journal_lines (
        *,
        accounts ( code, name )
      )
    `,
    )
    .eq("organization_id", organizationId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  return (data ?? []) as JournalEntryWithLines[];
}

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: Account["type"];
  debit: number;
  credit: number;
};

export async function getTrialBalance(): Promise<TrialBalanceRow[]> {
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) return [];

  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, type")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("code");

  if (!accounts?.length) return [];

  const { data: lines } = await supabase
    .from("journal_lines")
    .select(
      `
      account_id,
      debit,
      credit,
      journal_entries!inner ( status, organization_id )
    `,
    )
    .eq("journal_entries.organization_id", organizationId)
    .eq("journal_entries.status", "posted");

  const totals = new Map<string, { debit: number; credit: number }>();
  for (const line of lines ?? []) {
    const current = totals.get(line.account_id) ?? { debit: 0, credit: 0 };
    current.debit += Number(line.debit);
    current.credit += Number(line.credit);
    totals.set(line.account_id, current);
  }

  return accounts
    .map((account) => {
      const t = totals.get(account.id) ?? { debit: 0, credit: 0 };
      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type as Account["type"],
        debit: t.debit,
        credit: t.credit,
      };
    })
    .filter((row) => row.debit > 0 || row.credit > 0);
}

export async function getDashboardStats() {
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) {
    return {
      accountCount: 0,
      draftCount: 0,
      postedCount: 0,
      postedThisMonth: 0,
    };
  }

  const supabase = await createClient();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const monthStart = startOfMonth.toISOString().slice(0, 10);

  const [accountsRes, entriesRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_active", true),
    supabase
      .from("journal_entries")
      .select("status, entry_date")
      .eq("organization_id", organizationId),
  ]);

  const entries = entriesRes.data ?? [];
  return {
    accountCount: accountsRes.count ?? 0,
    draftCount: entries.filter((e) => e.status === "draft").length,
    postedCount: entries.filter((e) => e.status === "posted").length,
    postedThisMonth: entries.filter(
      (e) => e.status === "posted" && e.entry_date >= monthStart,
    ).length,
  };
}
