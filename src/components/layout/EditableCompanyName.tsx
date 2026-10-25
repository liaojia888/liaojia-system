"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ensureOrganizationAction,
  updateOrganizationName,
} from "@/app/actions/organization";
import {
  readLocalCompanyName,
  writeLocalCompanyName,
} from "@/lib/company-display-name";

export function EditableCompanyName({
  initialName,
  organizationId,
  compact,
  collapsed,
  variant = "default",
}: {
  initialName: string;
  organizationId: string | null;
  compact?: boolean;
  collapsed?: boolean;
  variant?: "default" | "sidebar";
}) {
  const onDark = variant === "sidebar";
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const local = readLocalCompanyName();
    if (local) {
      setName(local);
      setDraft(local);
      return;
    }
    setName(initialName);
    setDraft(initialName);
  }, [initialName]);

  function startEdit() {
    setDraft(name);
    setError(null);
    setHint(null);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(name);
    setError(null);
    setEditing(false);
  }

  function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("公司名稱不可為空");
      return;
    }

    startTransition(async () => {
      setError(null);
      setHint(null);

      let orgId = organizationId;
      if (!orgId) {
        const ensured = await ensureOrganizationAction(trimmed);
        orgId = ensured.organizationId;
        if (ensured.error && !orgId) {
          writeLocalCompanyName(trimmed);
          setName(trimmed);
          setEditing(false);
          setHint("已存於本機；請確認 Supabase 連線後再登入同步");
          return;
        }
      }

      if (orgId) {
        const result = await updateOrganizationName(trimmed);
        if (result.error) {
          writeLocalCompanyName(trimmed);
          setName(trimmed);
          setEditing(false);
          setError(result.error);
          setHint("名稱已暫存本機");
          return;
        }
        const next = result.name ?? trimmed;
        writeLocalCompanyName(next);
        setName(next);
        setDraft(next);
        setEditing(false);
        return;
      }

      writeLocalCompanyName(trimmed);
      setName(trimmed);
      setEditing(false);
    });
  }

  if (collapsed && !editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        title={`${name}（點擊編輯）`}
        className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition ${
          onDark
            ? "sidebar-org-badge hover:brightness-110"
            : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
        }`}
      >
        {name.slice(0, 1) || "企"}
      </button>
    );
  }

  if (editing) {
    return (
      <div className={compact ? "min-w-0 flex-1" : ""}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={pending}
          maxLength={80}
          autoFocus
          className={`w-full rounded-lg border px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-500 ${
            onDark
              ? "border-white/20 bg-slate-900/80 text-white"
              : "border-slate-300 bg-white text-slate-900"
          } ${compact ? "text-sm font-semibold" : "text-lg font-semibold"}`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") cancelEdit();
          }}
        />
        <div className="mt-1.5 flex flex-wrap gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="rounded bg-emerald-700 px-2 py-0.5 text-xs text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {pending ? "儲存中…" : "儲存"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={cancelEdit}
            className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50"
          >
            取消
          </button>
        </div>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
        {hint ? <p className="mt-1 text-xs text-amber-700">{hint}</p> : null}
      </div>
    );
  }

  return (
    <div className={compact ? "min-w-0 flex-1" : ""}>
      <button
        type="button"
        onClick={startEdit}
        className={`group w-full cursor-pointer rounded-lg border border-transparent text-left transition ${
          onDark
            ? "hover:border-white/10 hover:bg-white/5"
            : "hover:border-slate-200 hover:bg-slate-50"
        } ${compact ? "px-1 py-0.5" : "-mx-1 px-2 py-1"}`}
        title="點擊編輯公司名稱"
      >
        <span className="flex items-start gap-1.5">
          <span
            className={`min-w-0 flex-1 ${
              onDark ? "text-white" : "text-slate-900"
            } ${compact ? "truncate text-sm font-semibold" : "text-lg font-semibold"}`}
          >
            {name}
          </span>
          {!compact ? (
            <span
              className={`mt-1 shrink-0 ${
                onDark
                  ? "text-slate-500 group-hover:opacity-100"
                  : "text-slate-400 group-hover:text-emerald-700"
              }`}
              aria-hidden
            >
              ✎
            </span>
          ) : null}
        </span>
        {!compact ? (
          <span
            className={`mt-0.5 block text-xs ${
              onDark
                ? "text-slate-500 group-hover:text-[var(--sidebar-brand)]"
                : "text-slate-500 group-hover:text-emerald-700"
            }`}
          >
            點擊編輯公司名稱
          </span>
        ) : null}
      </button>
      {hint ? <p className="mt-1 text-xs text-amber-700">{hint}</p> : null}
    </div>
  );
}
