"use client";

import { useState, useTransition } from "react";
import {
  fetchAllLedgerMonths,
  importLedgerBackup,
} from "@/app/actions/daily-ledger";
import { ensureOrganizationAction } from "@/app/actions/organization";
import { readLocalCompanyName } from "@/lib/company-display-name";
import { downloadJsonBackup } from "@/lib/ledger-export";
import { normalizeRow, type DailyLedgerRow } from "@/lib/daily-ledger";
import {
  loadAllLocalMonths,
  replaceAllLocalMonths,
} from "@/lib/ledger-local-store";

export function LedgerBackupSettings() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function backupFromLocal() {
    setError(null);
    setMessage(null);
    const months = loadAllLocalMonths();
    const keys = Object.keys(months);
    if (keys.length === 0) {
      setError("本機尚無日結資料可備份。");
      return;
    }
    downloadJsonBackup(
      { version: 1, exportedAt: new Date().toISOString(), months },
      `ledger-backup-local-${new Date().toISOString().slice(0, 10)}.json`,
    );
    setMessage(`已下載本機 ${keys.length} 個月份的備份。`);
  }

  function backupFromCloud() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const ensured = await ensureOrganizationAction(
        readLocalCompanyName()?.trim() || "我的公司",
      );
      if (!ensured.organizationId) {
        setError(ensured.error ?? "尚未建立公司，請先點上方「建立公司並啟用雲端」。");
        return;
      }
      const result = await fetchAllLedgerMonths();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const months: Record<string, unknown> = {};
      for (const [key, payload] of Object.entries(result.months)) {
        months[key] = payload.rows;
      }
      const count = Object.keys(months).length;
      if (count === 0) {
        const local = loadAllLocalMonths();
        const localCount = Object.keys(local).length;
        if (localCount > 0) {
          setError(
            `雲端尚無日結資料（本機有 ${localCount} 個月）。請按「將本機日結上傳至雲端」，或至日結表開啟各月份以自動同步。`,
          );
        } else {
          setError(
            "雲端與本機都還沒有日結資料。請先到「日結表」輸入並存檔，再回來備份。",
          );
        }
        return;
      }
      downloadJsonBackup(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          source: "supabase",
          months,
        },
        `ledger-backup-cloud-${new Date().toISOString().slice(0, 10)}.json`,
      );
      setMessage(`已下載雲端 ${count} 個月份的備份。`);
    });
  }

  function uploadLocalToCloud() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const ensured = await ensureOrganizationAction(
        readLocalCompanyName()?.trim() || "我的公司",
      );
      if (!ensured.organizationId) {
        setError(ensured.error ?? "尚未建立公司。");
        return;
      }
      const months = loadAllLocalMonths();
      const count = Object.keys(months).length;
      if (count === 0) {
        setError("本機沒有日結資料可上傳。請先到日結表填寫。");
        return;
      }
      const result = await importLedgerBackup(months);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        `已將本機 ${count} 個月份上傳至雲端（成功 ${result.imported} 個月）。現在可再按「下載雲端備份 JSON」。`,
      );
    });
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    startTransition(async () => {
      setError(null);
      setMessage(null);
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as {
          months?: Record<string, { rows?: unknown[] } | unknown[]>;
        };
        const raw = parsed.months ?? {};
        const months: Record<string, DailyLedgerRow[]> = {};

        for (const [key, value] of Object.entries(raw)) {
          const rows = Array.isArray(value)
            ? value
            : (value as { rows?: unknown[] })?.rows;
          if (Array.isArray(rows) && rows.length) {
            months[key] = rows.map((r) =>
              normalizeRow(r as Record<string, unknown>),
            );
          }
        }

        const count = Object.keys(months).length;
        if (count === 0) {
          setError("檔案中沒有可匯入的月份資料。");
          return;
        }

        replaceAllLocalMonths(months);
        const cloud = await importLedgerBackup(months);
        if (!cloud.ok) {
          setMessage(`已寫入本機 ${count} 個月；雲端匯入失敗：${cloud.error}`);
          return;
        }

        setMessage(
          `已匯入 ${count} 個月（本機 + 雲端 ${cloud.imported} 個月）。請重新整理日結表。`,
        );
      } catch {
        setError("無法解析 JSON 備份檔。");
      }
    });
  }

  return (
    <section className="report-page-card rounded-2xl p-5 sm:p-6">
      <h2 className="report-block-title text-lg font-semibold">備份與還原</h2>
      <p className="mt-1 text-sm text-slate-600">
        日結預設先存本機，編輯後會自動同步雲端。若雲端是空的，可用「上傳本機」一次匯入。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={backupFromLocal}
          disabled={pending}
          className="ledger-touch-btn ledger-btn-ghost rounded-full px-4 py-2.5 text-sm font-medium"
        >
          下載本機備份 JSON
        </button>
        <button
          type="button"
          onClick={uploadLocalToCloud}
          disabled={pending}
          className="ledger-touch-btn ledger-btn-primary rounded-full px-4 py-2.5 text-sm font-medium"
        >
          將本機日結上傳至雲端
        </button>
        <button
          type="button"
          onClick={backupFromCloud}
          disabled={pending}
          className="ledger-touch-btn ledger-btn-ghost rounded-full px-4 py-2.5 text-sm font-medium"
        >
          下載雲端備份 JSON
        </button>
        <label className="ledger-touch-btn cursor-pointer rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50">
          從 JSON 還原
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFile}
          />
        </label>
      </div>
      {message ? (
        <p className="mt-3 text-sm text-emerald-800">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-red-700">{error}</p>
      ) : null}
    </section>
  );
}
