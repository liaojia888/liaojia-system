import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { LedgerLayoutSettings } from "@/components/settings/LedgerLayoutSettings";
import { AuthAccountPanel } from "@/components/settings/AuthAccountPanel";
import { EnsureOrganizationPanel } from "@/components/settings/EnsureOrganizationPanel";
import { LedgerAuditLogPanel } from "@/components/settings/LedgerAuditLogPanel";
import { LedgerBackupSettings } from "@/components/settings/LedgerBackupSettings";
import { ensureOrganizationForUser } from "@/lib/organization";
import { getOrganizationContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  let { organizationId } = await getOrganizationContext();
  if (!organizationId) {
    await ensureOrganizationForUser("我的公司");
    ({ organizationId } = await getOrganizationContext());
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--theme-accent-strong)]">
          系統設定
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          個人化工作台
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          調整介面外觀，讓日結表更符合你的使用習慣。
        </p>
      </div>
      <EnsureOrganizationPanel hasOrganization={Boolean(organizationId)} />
      <AuthAccountPanel
        email={user?.email ?? null}
        emailConfirmed={Boolean(user?.email_confirmed_at)}
      />
      <LedgerAuditLogPanel />
      <AppearanceSettings />
      <LedgerLayoutSettings />
      <LedgerBackupSettings />
    </div>
  );
}
