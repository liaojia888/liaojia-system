import { MonthlyLedgerReport } from "@/components/dashboard/MonthlyLedgerReport";
import { getOrganizationContext } from "@/lib/queries";

export default async function ReportsPage() {
  const { organizationId } = await getOrganizationContext();

  return (
    <div className="-mx-2 overflow-hidden rounded-xl sm:-mx-4 md:-mx-6 lg:-mx-8">
      <MonthlyLedgerReport organizationId={organizationId} />
    </div>
  );
}
