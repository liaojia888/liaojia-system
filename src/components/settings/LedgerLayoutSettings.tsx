"use client";

import Link from "next/link";
import {
  LEDGER_LAYOUT_OPTIONS,
  type LedgerLayoutId,
} from "@/lib/ledger-layout";
import { useLedgerLayout } from "@/components/providers/LedgerLayoutProvider";

function LayoutPreview({ id }: { id: LedgerLayoutId }) {
  if (id === "workbench") {
    return (
      <div className="flex h-16 flex-col gap-1 bg-slate-50 p-2">
        <div className="flex gap-1">
          <span className="h-2 flex-1 rounded bg-emerald-700/80" />
          <span className="h-2 w-8 rounded bg-slate-200" />
        </div>
        <div className="flex flex-1 flex-col gap-1 overflow-hidden">
          <span className="h-3 rounded border border-slate-200 bg-white" />
          <span className="h-3 rounded border border-slate-200 bg-white" />
          <span className="h-3 w-[80%] rounded border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }
  if (id === "spreadsheetMobile") {
    return (
      <div className="flex h-16 flex-col gap-1 bg-slate-50 p-2">
        <div className="flex gap-1">
          <span className="h-2 flex-1 rounded bg-emerald-700/80" />
          <span className="h-2 w-6 rounded bg-amber-400/80" title="支出欄" />
        </div>
        <div className="grid flex-1 grid-cols-5 gap-px overflow-hidden rounded border border-slate-200 bg-slate-200">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className="bg-white" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-16 flex-col gap-1 bg-slate-50 p-2">
      <div className="h-2 w-full rounded bg-emerald-700/70" />
      <div className="grid flex-1 grid-cols-6 gap-px overflow-hidden rounded border border-slate-200 bg-slate-200">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="bg-white" />
        ))}
      </div>
    </div>
  );
}

export function LedgerLayoutSettings() {
  const { layout, setLayout } = useLedgerLayout();

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">日結表介面</h2>
      <p className="mt-1 text-sm text-slate-600">
        選擇你偏好的日結表版型；已登入時會同步至 Supabase 帳號。變更後請至{" "}
        <Link href="/dashboard" className="font-medium text-emerald-800 underline">
          日結表
        </Link>{" "}
        查看（重新整理即可）。
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {LEDGER_LAYOUT_OPTIONS.map((option) => {
          const selected = layout === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => setLayout(option.id)}
                className={`flex w-full flex-col overflow-hidden rounded-xl border text-left transition-all duration-200 ${
                  selected
                    ? "border-[var(--theme-accent)] ring-2 ring-[var(--theme-accent)]/30 shadow-md"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <LayoutPreview id={option.id} />
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">
                      {option.name}
                    </span>
                    {selected ? (
                      <span className="rounded-full bg-[var(--theme-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--theme-accent-strong)]">
                        使用中
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {option.description}
                  </p>
                  <p className="mt-2 flex flex-wrap gap-1">
                    {option.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
