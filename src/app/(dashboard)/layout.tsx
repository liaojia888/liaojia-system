import { AppShell } from "@/components/layout/AppShell";
import { AppThemeProvider } from "@/components/providers/AppThemeProvider";
import { themeFromUserMetadata } from "@/lib/app-theme";
import { ensureOrganizationForUser } from "@/lib/organization";
import { getOrganizationContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let { organization, organizationId } = await getOrganizationContext();

  if (!organizationId) {
    await ensureOrganizationForUser(organization?.name?.trim() || "我的公司");
    ({ organization, organizationId } = await getOrganizationContext());
  }

  const orgDisplayName = organization?.name?.trim() || "我的公司";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const initialThemeFromAccount = themeFromUserMetadata(user?.user_metadata);

  return (
    <AppThemeProvider initialThemeFromAccount={initialThemeFromAccount}>
      <AppShell orgName={orgDisplayName} organizationId={organizationId}>
        {children}
      </AppShell>
    </AppThemeProvider>
  );
}
