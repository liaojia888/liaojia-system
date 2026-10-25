"use client";

import { useState } from "react";
import { useActionState } from "react";
import { resendVerificationEmail } from "@/app/actions/auth";

export function LoginSupportPanel() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    resendVerificationEmail,
    { error: null, notice: null } as { error: string | null; notice: string | null },
  );

  return (
    <div className="auth-support mt-6 rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        aria-expanded={open}
      >
        <span>收不到驗證信或無法登入？</span>
        <span
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? (
        <div className="space-y-4 border-t border-slate-100 px-4 pb-4 pt-3">
          <ul className="list-disc space-y-2 pl-4 text-xs leading-relaxed text-slate-600">
            <li>
              若提示「Email 尚未驗證」，請至信箱（含<strong>垃圾郵件</strong>
              ）點擊驗證連結。
            </li>
            <li>
              驗證會導向 <code className="rounded bg-slate-100 px-1">/auth/callback</code>
              ，請確認 Vercel 已設定{" "}
              <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_APP_URL</code>{" "}
              為正式網址。
            </li>
            <li>短時間多次寄信可能被限速，請稍候再試。</li>
          </ul>
          <form action={formAction} className="space-y-2">
            <p className="text-xs font-medium text-slate-800">重新寄出驗證信</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="auth-input min-w-0 flex-1 text-sm"
              />
              <button
                type="submit"
                disabled={pending}
                className="auth-btn-secondary shrink-0 px-4 py-2.5 text-sm disabled:opacity-60"
              >
                {pending ? "寄送中…" : "寄出"}
              </button>
            </div>
            {state?.notice ? (
              <p className="text-xs text-emerald-700">{state.notice}</p>
            ) : null}
            {state?.error ? (
              <p className="text-xs text-red-600">{state.error}</p>
            ) : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}
