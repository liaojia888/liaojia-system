import { WorkResourceClient } from "@/components/resources/WorkResourceClient";
import { getOrganizationContext } from "@/lib/queries";

export default async function WorkResourcesPage() {
  const { organizationId } = await getOrganizationContext();

  return (
    <div className="-mx-2 flex min-h-[calc(100dvh-3.25rem)] flex-col overflow-hidden rounded-xl sm:-mx-4 md:-mx-6 md:min-h-[calc(100dvh-4rem)] lg:-mx-8">
      <WorkResourceClient organizationId={organizationId} />
    </div>
  );
}
