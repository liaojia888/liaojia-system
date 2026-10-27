import Link from "next/link";

const FEATURES = [
  "日結表即時加總與 Supabase 備份",
  "月結摘要、年度趨勢與備份",
  "多裝置登入，主題跟著帳號走",
];

export function AuthPageShell({
  children,
  kicker = "Liaojia Accounting",
  title = "會計工作台",
  description = "專為日常對帳與月結設計，介面清楚、資料可備份至 Supabase。",
}: {
  children: React.ReactNode;
  kicker?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div className="auth-page min-h-full lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <div className="auth-page-brand relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14">
        <div className="auth-page-brand-glow pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full blur-3xl" />
        <div className="auth-page-brand-glow pointer-events-none absolute -bottom-16 right-0 h-64 w-64 rounded-full blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/90">
            {kicker}
          </p>
          <h1 className="mt-4 max-w-md text-4xl font-semibold leading-tight tracking-tight text-white xl:text-[2.75rem]">
            {title}
          </h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-emerald-50/85">
            {description}
          </p>
        </div>
        <ul className="relative mt-10 space-y-3">
          {FEATURES.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 text-sm text-emerald-50/90"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs text-white">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
        <p className="relative text-xs text-emerald-100/50">
          © {new Date().getFullYear()} Liaojia System
        </p>
      </div>

      <div className="auth-page-main flex min-h-full flex-col justify-center px-4 py-10 sm:px-8 lg:py-12">
        <div className="mx-auto w-full max-w-[26rem]">
          <div className="mb-8 text-center lg:hidden">
            <Link
              href="/login"
              className="inline-flex flex-col items-center gap-1"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700">
                Liaojia
              </span>
              <span className="text-lg font-semibold text-slate-900">
                會計管理系統
              </span>
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
