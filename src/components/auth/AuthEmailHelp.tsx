export function AuthEmailHelp({ variant = "login" }: { variant?: "login" | "signup" }) {
  return (
    <details className="mx-auto mb-4 max-w-md rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
      <summary className="cursor-pointer font-medium text-slate-900">
        Email 驗證與收不到信？
      </summary>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
        {variant === "signup" ? (
          <li>
            若 Supabase 專案開啟「Confirm email」，註冊後需先點信內連結，才能登入。
          </li>
        ) : (
          <li>
            登入若提示「Email 尚未驗證」，請至信箱（含<strong>垃圾郵件</strong>
            ）完成驗證後再試。
          </li>
        )}
        <li>
          驗證連結會導回 <code className="text-xs">/auth/callback</code>
          ，請確認 Vercel 環境變數{" "}
          <code className="text-xs">NEXT_PUBLIC_APP_URL</code> 與實際網址一致。
        </li>
        <li>
          開發階段可在 Supabase → Authentication → Providers → Email
          暫時關閉 Confirm email，方便立即測試（上線前建議再開啟）。
        </li>
        <li>重設密碼信與驗證信共用寄信配額，短時間多次申請可能被限速。</li>
      </ul>
    </details>
  );
}
