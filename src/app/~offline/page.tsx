import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-emerald-50 px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
        Liaojia
      </p>
      <h1 className="mt-3 text-2xl font-semibold text-slate-900">目前離線</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
        無法連線時無法載入最新頁面。日結若先前已開啟，部分資料可能仍在本機；恢復網路後請重新整理以同步
        Supabase。
      </p>
      <Link
        href="/dashboard"
        className="mt-8 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
      >
        再試一次
      </Link>
    </div>
  );
}
