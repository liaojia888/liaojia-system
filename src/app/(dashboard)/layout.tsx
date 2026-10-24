import { AppShell } from "@/components/layout/AppShell";
import { ensureOrganizationForUser } from "@/lib/organization";
import { getOrganizationContext } from "@/lib/queries";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let { organization, organizationId } = await getOrganizationContext();

  if (!organization) {
    await ensureOrganizationForUser("我的公司");
    ({ organization, organizationId } = await getOrganizationContext());
  }

  const orgDisplayName = organization?.name?.trim() || "我的公司";

  return (
    <AppShell
      orgName={orgDisplayName}
      organizationId={organizationId}
    >
      {children}
    </AppShell>
  );
}
