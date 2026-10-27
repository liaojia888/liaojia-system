"use client";

import { useState, useTransition } from "react";
import { ensureOrganizationAction } from "@/app/actions/organization";
import { readLocalCompanyName } from "@/lib/company-display-name";

export function EnsureOrganizationPanel({
  hasOrganization,
}: {
  hasOrganization: boolean;
}) {
  const [done, setDone] = useState(hasOrganization);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5">
      <h2 className="text-base font-semibold text-amber-950">尚未在 Supabase 建立公司</h2>
      <p className="mt-1 text-sm text-amber-900/90">
        側邊欄公司名稱可能只存在本機。資料庫日結與「下載 Supabase 備份」需要在 Supabase
        建立公司與您的帳號關聯（只需一次）。
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            setError(null);
            setMessage(null);
            const name =
              readLocalCompanyName()?.trim() ||
              prompt("請輸入公司名稱", "我的公司")?.trim() ||
              "我的公司";
            const result = await ensureOrganizationAction(name);
            if (result.organizationId) {
              setDone(true);
              setMessage("已建立公司，請再試 Supabase 備份或開啟日結表。");
              window.location.reload();
              return;
            }
            setError(
              result.error ??
                "建立失敗。請確認 Supabase 已執行 001、002 migration，且已登入。",
            );
          });
        }}
        className="ledger-touch-btn ledger-btn-primary mt-3 rounded-full px-4 py-2.5 text-sm font-medium"
      >
        {pending ? "建立中…" : "建立公司（寫入 Supabase）"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-2 text-sm text-emerald-800">{message}</p> : null}
    </section>
  );
}
