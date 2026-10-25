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
    <div className="auth-card overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)]">
      <div className="auth-card-header px-8 pb-1 pt-8 sm:px-9 sm:pt-9">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{subtitle}</p>
      </div>
      <form action={formAction} className="space-y-4 px-8 pb-8 pt-6 sm:px-9 sm:pb-9">
        {fields}
        {state?.notice ? (
          <p className="auth-alert auth-alert-success">{state.notice}</p>
        ) : null}
        {state?.error ? (
          <p className="auth-alert auth-alert-error">{state.error}</p>
        ) : null}
        <button type="submit" disabled={pending} className="auth-btn-primary">
          {pending ? "處理中…" : submitLabel}
        </button>
      </form>
      {footer ? (
        <div className="auth-card-footer border-t border-slate-100 px-8 py-5 text-center text-sm sm:px-9">
          {footer}
        </div>
      ) : null}
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
      <span className="mb-1.5 block font-medium text-slate-800">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={
          type === "password"
            ? "current-password"
            : type === "email"
              ? "email"
              : undefined
        }
        className="auth-input"
      />
    </label>
  );
}

export function AuthAlert({
  variant,
  children,
}: {
  variant: "success" | "warning";
  children: React.ReactNode;
}) {
  return (
    <p
      className={`auth-alert mb-4 ${variant === "success" ? "auth-alert-success" : "auth-alert-warning"}`}
    >
      {children}
    </p>
  );
}
