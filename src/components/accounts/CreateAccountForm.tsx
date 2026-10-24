"use client";

import { useActionState } from "react";
import { createAccount } from "@/app/actions/accounts";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@/types/database";

const types = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

export function CreateAccountForm() {
  const [state, formAction, pending] = useActionState(createAccount, {
    error: null as string | null,
  });

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-4">
      <input
        name="code"
        placeholder="科目代碼"
        required
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        name="name"
        placeholder="科目名稱"
        required
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
      />
      <select
        name="type"
        required
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        defaultValue="asset"
      >
        {types.map((t) => (
          <option key={t} value={t}>
            {ACCOUNT_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      <div className="md:col-span-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "新增中…" : "新增科目"}
        </button>
        {state?.error ? (
          <span className="text-sm text-red-600">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}
