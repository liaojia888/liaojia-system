import { DailyLedgerSheet } from "@/components/dashboard/DailyLedgerSheet";

export default function DashboardPage() {
  return (
    <div className="-mx-2 flex min-h-[calc(100dvh-3.25rem)] flex-col sm:-mx-4 md:-mx-8 md:min-h-[calc(100dvh-4rem)]">
      <DailyLedgerSheet />
    </div>
  );
}
