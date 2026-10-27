"use client";

import { useState, useTransition } from "react";
import {
  fetchAllLedgerMonths,
  importLedgerBackup,
} from "@/app/actions/daily-ledger";
import { ensureOrganizationAction } from "@/app/actions/organization";
import { readLocalCompanyName } from "@/lib/company-display-name";
import { downloadJsonBackup } from "@/lib/ledger-export";
import {
  defaultRowsForMonth,
  normalizeRow,
  sortRowsByDate,
  type DailyLedgerRow,
} from "@/lib/daily-ledger";
import {
  clearAllLocalLedgerMonths,
  loadAllLocalMonths,
  markLocalRemoteAppliedAt,
  replaceAllLocalMonths,
} from "@/lib/ledger-local-store";
import {
  applyRemoteMonthToLocalTemplate,
  mergeLocalMonthWithRemote,
} from "@/lib/ledger-row-merge";
import {
  mergeParsedRowIntoMonth,
  monthKeyFromIsoDate,
  parseLedgerRowFromWhatsApp,
} from "@/lib/whatsapp-row-import";

export function LedgerBackupSettings() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whatsappPaste, setWhatsappPaste] = useState("");
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
        setError(ensured.error ?? "尚未建立公司，請先點上方「建立公司（Supabase）」。");
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
            `Supabase 尚無日結資料（本機有 ${localCount} 個月）。請按「將本機日結寫入 Supabase」，或至日結表按「儲存至 Supabase」。`,
          );
        } else {
          setError(
            "Supabase 與本機都還沒有日結資料。請先到「日結表」輸入並存本機，再回來備份。",
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
      setMessage(`已下載 Supabase ${count} 個月份的備份。`);
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
        `已將本機 ${count} 個月份寫入 Supabase（成功 ${result.imported} 個月）。現在可再按「下載 Supabase 備份 JSON」。`,
      );
    });
  }

  function restoreFromWhatsAppPaste() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const parsed = parseLedgerRowFromWhatsApp(whatsappPaste);
      if (!parsed) {
        setError(
          "無法辨識內容。請貼上 WhatsApp「匯出此列」的完整文字（含【日結單列】與日期）。",
        );
        return;
      }

      const monthKey = monthKeyFromIsoDate(parsed.date);
      const [yearStr, monthStr] = monthKey.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);
      if (!year || !month) {
        setError("日期格式不正確。");
        return;
      }

      const all = loadAllLocalMonths();
      const existing = all[monthKey];
      const baseRows =
        (existing?.length ?? 0) > 0
          ? existing!
          : defaultRowsForMonth(year, month);
      const merged = mergeParsedRowIntoMonth(baseRows, parsed);
      replaceAllLocalMonths({ ...all, [monthKey]: merged });

      const cloud = await importLedgerBackup({ [monthKey]: merged });
      if (!cloud.ok) {
        setMessage(
          `已寫入本機 ${parsed.date} 這一列；寫入 Supabase 失敗：${cloud.error}。請重新整理日結表。`,
        );
        return;
      }

      setMessage(
        `已還原 ${parsed.date} 的日結列（本機 + Supabase）。請重新整理日結表確認。`,
      );
      setWhatsappPaste("");
    });
  }

  function pullAllMonthsFromSupabase() {
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
      const result = await fetchAllLedgerMonths();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const keys = Object.keys(result.months);
      if (keys.length === 0) {
        setError("Supabase 尚無任何月份日結。");
        return;
      }
      const existing = loadAllLocalMonths();
      const mergedAll: Record<string, DailyLedgerRow[]> = { ...existing };
      for (const [monthKey, payload] of Object.entries(result.months)) {
        const [y, m] = monthKey.split("-").map(Number);
        const local =
          existing[monthKey]?.length && y && m
            ? existing[monthKey]
            : y && m
              ? defaultRowsForMonth(y, m)
              : sortRowsByDate(payload.rows);
        mergedAll[monthKey] = applyRemoteMonthToLocalTemplate(
          local,
          payload.rows,
        );
      }
      replaceAllLocalMonths(mergedAll);
      for (const [monthKey, payload] of Object.entries(result.months)) {
        if (payload.updatedAt) {
          markLocalRemoteAppliedAt(monthKey, payload.updatedAt);
        }
      }
      setMessage(
        `已從 Supabase 合併 ${keys.length} 個月份至本機。請至日結表重新整理或切換月份查看。`,
      );
    });
  }

  function clearLocalLedgerCache() {
    const count = Object.keys(loadAllLocalMonths()).length;
    if (count === 0) {
      setError(null);
      setMessage("本機日結快取已是空的。");
      return;
    }
    const ok = confirm(
      `確定要清除本機 ${count} 個月份的日結快取？\n\n` +
        "Supabase 資料庫不會刪除。清除後日結表會顯示空白月模板；若雲端有備份，請到日結表手動「合併 Supabase 資料」或從 JSON 還原。",
    );
    if (!ok) return;

    setError(null);
    setMessage(null);
    const cleared = clearAllLocalLedgerMonths();
    setMessage(
      cleared > 0
        ? `已清除本機 ${cleared} 個月份的日結快取。若日結表已開啟，請切換月份或重新整理以更新畫面。`
        : "本機日結快取已是空的。",
    );
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
          setMessage(`已寫入本機 ${count} 個月；Supabase 匯入失敗：${cloud.error}`);
          return;
        }

        setMessage(
          `已匯入 ${count} 個月（本機 + Supabase ${cloud.imported} 個月）。請重新整理日結表。`,
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
        登入後日結表會自動從 Supabase 載入目前月份；編輯會存本機，改動後請按「儲存至
        Supabase」讓手機／其他電腦看到最新資料。新裝置可先按「從 Supabase 載入全部月份」。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={pullAllMonthsFromSupabase}
          disabled={pending}
          className="ledger-touch-btn ledger-btn-primary rounded-full px-4 py-2.5 text-sm font-medium"
        >
          從 Supabase 載入全部月份
        </button>
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
          將本機日結寫入 Supabase
        </button>
        <button
          type="button"
          onClick={backupFromCloud}
          disabled={pending}
          className="ledger-touch-btn ledger-btn-ghost rounded-full px-4 py-2.5 text-sm font-medium"
        >
          下載 Supabase 備份 JSON
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
      <div className="mt-6 border-t border-slate-200 pt-5">
        <h3 className="text-base font-semibold text-slate-900">本機快取</h3>
        <p className="mt-1 text-sm text-slate-600">
          僅刪除此 Chrome 設定檔內的日結 localStorage，不影響 Supabase。開發時若畫面與登入帳號混亂，可先備份 JSON 再清除。
        </p>
        <button
          type="button"
          onClick={clearLocalLedgerCache}
          disabled={pending}
          className="ledger-touch-btn mt-3 rounded-full border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-900 hover:bg-red-100"
        >
          清除本機日結快取
        </button>
      </div>
      <div className="mt-6 border-t border-slate-200 pt-5">
        <h3 className="text-base font-semibold text-slate-900">
          從 WhatsApp 文字還原單列
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          若匯出後畫面資料消失，可把 WhatsApp 訊息全文貼上，還原對應日期那一列。
        </p>
        <textarea
          value={whatsappPaste}
          onChange={(e) => setWhatsappPaste(e.target.value)}
          rows={8}
          placeholder="貼上【日結單列】… 的完整文字"
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={restoreFromWhatsAppPaste}
          disabled={pending || !whatsappPaste.trim()}
          className="ledger-touch-btn ledger-btn-primary mt-2 rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          還原此列
        </button>
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
