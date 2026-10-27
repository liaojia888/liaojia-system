"use client";

import dynamic from "next/dynamic";

const DailyLedgerSheet = dynamic(
  () =>
    import("@/components/dashboard/DailyLedgerSheet").then(
      (m) => m.DailyLedgerSheet,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        載入日結表…
      </div>
    ),
  },
);

export function DashboardLedgerClient({
  organizationId,
}: {
  organizationId: string | null;
}) {
  return <DailyLedgerSheet organizationId={organizationId} />;
}
