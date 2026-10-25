"use client";

import { useActionState } from "react";
import { resendVerificationEmail } from "@/app/actions/auth";

export function ResendVerificationForm() {
  const [state, formAction, pending] = useActionState(
    resendVerificationEmail,
    { error: null, notice: null } as { error: string | null; notice: string | null },
  );

  return (
    <form
      action={formAction}
      className="mx-auto mb-4 max-w-md rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
    >
      <p className="text-sm font-medium text-slate-900">重新寄出 Email 驗證信</p>
      <p className="mt-1 text-xs text-slate-600">
        若註冊後收不到信，輸入 Email 後再試（15 分鐘內最多 3 次）。
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "寄送中…" : "寄出驗證信"}
        </button>
      </div>
      {state?.notice ? (
        <p className="mt-2 text-sm text-emerald-700">{state.notice}</p>
      ) : null}
      {state?.error ? (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}
