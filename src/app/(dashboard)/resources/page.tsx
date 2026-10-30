import { Suspense } from "react";
import { WorkResourceClient } from "@/components/resources/WorkResourceClient";
import { getOrganizationContext } from "@/lib/queries";

export default async function WorkResourcesPage() {
  const { organizationId } = await getOrganizationContext();

  return (
    <div className="-mx-2 flex min-h-[calc(100dvh-3.25rem)] flex-col overflow-hidden rounded-xl sm:-mx-4 md:-mx-6 md:min-h-[calc(100dvh-4rem)] lg:-mx-8">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            載入資源表…
          </div>
        }
      >
        <WorkResourceClient organizationId={organizationId} />
      </Suspense>
    </div>
  );
}
