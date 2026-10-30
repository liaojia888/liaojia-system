export function ReportPageSkeleton() {
  return (
    <div className="report-page-card animate-pulse space-y-4 rounded-2xl p-6">
      <div className="h-4 w-40 rounded bg-slate-200" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-24 rounded-xl bg-slate-100" />
        <div className="h-24 rounded-xl bg-slate-100" />
      </div>
      <div className="h-32 rounded-xl bg-slate-100" />
    </div>
  );
}
