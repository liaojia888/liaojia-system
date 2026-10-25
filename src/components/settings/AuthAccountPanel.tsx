"use client";

import { useActionState } from "react";
import { resendVerificationEmail } from "@/app/actions/auth";

export function AuthAccountPanel({
  email,
  emailConfirmed,
}: {
  email: string | null;
  emailConfirmed: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    resendVerificationEmail,
    { error: null, notice: null } as { error: string | null; notice: string | null },
  );

  return (
    <section className="report-page-card rounded-2xl border p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">登入與 Email</h2>
      <p className="mt-1 text-sm text-slate-600">
        帳號維運資訊；登入／重設密碼已啟用簡易速率限制，防止短時間暴力嘗試。
      </p>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-slate-600">登入 Email</dt>
          <dd className="font-medium text-slate-900">{email ?? "—"}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-slate-600">Email 驗證</dt>
          <dd>
            {emailConfirmed ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                已驗證
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                尚未驗證
              </span>
            )}
          </dd>
        </div>
      </dl>

      {!emailConfirmed && email ? (
        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            disabled={pending}
            className="ledger-touch-btn ledger-btn-ghost rounded-full px-4 py-2 text-sm font-medium shadow-sm disabled:opacity-60"
          >
            {pending ? "寄送中…" : "重新寄出驗證信"}
          </button>
          {state?.notice ? (
            <p className="text-sm text-emerald-700">{state.notice}</p>
          ) : null}
          {state?.error ? (
            <p className="text-sm text-red-600">{state.error}</p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
