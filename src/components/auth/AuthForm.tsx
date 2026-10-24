"use client";

import { useActionState } from "react";

type AuthState = { error: string | null; notice: string | null };

type AuthAction = (
  prev: AuthState | void,
  formData: FormData,
) => Promise<AuthState | void>;

export function AuthForm({
  title,
  subtitle,
  action,
  submitLabel,
  fields,
  footer,
}: {
  title: string;
  subtitle: string;
  action: AuthAction;
  submitLabel: string;
  fields: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    notice: null,
  } satisfies AuthState);

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
      <form action={formAction} className="mt-8 space-y-4">
        {fields}
        {state?.notice ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {state.notice}
          </p>
        ) : null}
        {state?.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "處理中…" : submitLabel}
        </button>
      </form>
      {footer ? <div className="mt-6 text-center text-sm">{footer}</div> : null}
    </div>
  );
}

export function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-slate-400 focus:ring-2"
      />
    </label>
  );
}
