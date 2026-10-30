import { Suspense } from "react";
import { DashboardLedgerClient } from "@/components/dashboard/DashboardLedgerClient";
import { getOrganizationContext } from "@/lib/queries";

export default async function DashboardPage() {
  const { organizationId } = await getOrganizationContext();

  return (
    <div className="-mx-2 flex min-h-[calc(100dvh-3.25rem)] flex-col overflow-hidden rounded-xl sm:-mx-4 md:-mx-6 md:min-h-[calc(100dvh-4rem)] lg:-mx-8">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            載入日結表…
          </div>
        }
      >
        <DashboardLedgerClient organizationId={organizationId} />
      </Suspense>
    </div>
  );
}
