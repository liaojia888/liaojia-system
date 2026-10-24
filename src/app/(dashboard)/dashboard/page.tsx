import { DailyLedgerSheet } from "@/components/dashboard/DailyLedgerSheet";

export default function DashboardPage() {
  return (
    <div className="-mx-4 flex min-h-[calc(100dvh-3.5rem)] flex-col md:-mx-8 md:min-h-[calc(100dvh-4rem)]">
      <DailyLedgerSheet />
    </div>
  );
}
