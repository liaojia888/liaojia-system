"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LedgerNoteContextMenu,
  LedgerNoteEditor,
  type ContextMenuState,
} from "@/components/dashboard/LedgerNoteMenus";
import { WorkResourceMobileRows } from "@/components/resources/WorkResourceMobileRows";
import { useWorkResourceMonthData } from "@/hooks/useWorkResourceMonthData";
import { readLocalCompanyName } from "@/lib/company-display-name";
import {
  WORK_RESOURCE_CATEGORIES,
  computeWorkResourceMonthTotals,
  computeWorkResourceRows,
  createEmptyWorkResourceRow,
  sortWorkResourceRows,
  type WorkResourceCategoryKey,
  type WorkResourceRow,
} from "@/lib/work-resources";
import {
  formatWorkResourceMonthForWhatsApp,
  formatWorkResourceRowForWhatsApp,
  openWhatsAppShare,
  shareViaWeChat,
  weChatShareSuccessMessage,
} from "@/lib/whatsapp-export";

function formatNum(n: number): string {
  if (!n) return "";
  return n.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

function formatSigned(n: number): string {
  if (n === 0) return "0";
  const abs = formatNum(Math.abs(n));
  return n > 0 ? abs : `−${abs}`;
}

function parseNum(raw: string): number {
  const v = Number(raw.replace(/,/g, "").replace(/−/g, "-").trim());
  return Number.isFinite(v) ? v : 0;
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function syncStatusLabel(
  status: string,
  cloudDirty: boolean,
): string | null {
  if (status === "syncing") return "同步中…";
  if (status === "conflict") return "雲端版本衝突";
  if (status === "error") return "同步錯誤";
  if (status === "local_only") return "僅本機儲存";
  if (cloudDirty || status === "cloud_pending") return "有未上傳變更";
  if (status === "synced") return "已與 Supabase 同步";
  return "已存本機";
}

export function WorkResourceSheet({
  organizationId,
}: {
  organizationId: string | null;
}) {
  const searchParams = useSearchParams();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    const y = searchParams.get("year");
    const m = searchParams.get("month");
    if (y && /^\d{4}$/.test(y)) setYear(Number(y));
    if (m) {
      const mn = Number.parseInt(m, 10);
      if (mn >= 1 && mn <= 12) setMonth(mn);
    }
  }, [searchParams]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [noteEditor, setNoteEditor] = useState<{
    rowId: string;
    initialText: string;
  } | null>(null);
  const key = monthKey(year, month);

  const {
    rows,
    setRows,
    ready,
    syncStatus,
    syncMessage,
    cloudConflict,
    cloudDirty,
    isSavingCloud,
    pullCloudMonth,
    saveToCloud,
    applyCloudVersion,
    dismissCloudConflict,
    persistBeforeShare,
  } = useWorkResourceMonthData({
    monthKey: key,
    year,
    month,
    organizationId,
  });

  const computed = useMemo(() => computeWorkResourceRows(rows), [rows]);
  const totals = useMemo(
    () => computeWorkResourceMonthTotals(computed),
    [computed],
  );

  const shiftMonth = useCallback((delta: number) => {
    setMonth((m) => {
      let nextM = m + delta;
      let nextY = year;
      if (nextM < 1) {
        nextM = 12;
        nextY -= 1;
      } else if (nextM > 12) {
        nextM = 1;
        nextY += 1;
      }
      setYear(nextY);
      return nextM;
    });
  }, [year]);

  const updateRow = useCallback(
    (id: string, patch: Partial<WorkResourceRow>) => {
      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      );
    },
    [setRows],
  );

  const updateCount = useCallback(
    (id: string, category: WorkResourceCategoryKey, value: number) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== id) return row;
          return {
            ...row,
            counts: { ...row.counts, [category]: value },
          };
        }),
      );
    },
    [setRows],
  );

  const companyName = readLocalCompanyName() ?? "我的公司";

  const openRowContextMenu = useCallback(
    (e: React.MouseEvent, rowId: string) => {
      e.preventDefault();
      setContextMenu({ rowId, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const openNoteContextMenu = useCallback(
    (e: React.MouseEvent, rowId: string) => {
      e.preventDefault();
      setContextMenu({
        rowId,
        noteKey: "rowNote",
        x: e.clientX,
        y: e.clientY,
      });
    },
    [],
  );

  const openMenuFromAnchor = useCallback(
    (rowId: string, anchor: HTMLElement, noteKey?: ContextMenuState["noteKey"]) => {
      const rect = anchor.getBoundingClientRect();
      setContextMenu({
        rowId,
        noteKey,
        x: Math.min(rect.left, window.innerWidth - 200),
        y: rect.bottom + 4,
      });
    },
    [],
  );

  const clearRow = useCallback(
    (rowId: string) => {
      if (!confirm("確定要清空這一行的數量與備註？（日期保留）")) return;
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          return { ...createEmptyWorkResourceRow(row.date), id: row.id };
        }),
      );
    },
    [setRows],
  );

  const insertRowAfter = useCallback(
    (rowId: string) => {
      setRows((prev) => {
        const sorted = sortWorkResourceRows(prev);
        const index = sorted.findIndex((r) => r.id === rowId);
        if (index === -1) return prev;
        const anchor = sorted[index];
        const newRow = createEmptyWorkResourceRow(anchor.date);
        const next = [...sorted];
        next.splice(index + 1, 0, newRow);
        return next;
      });
    },
    [setRows],
  );

  const removeRow = useCallback(
    (rowId: string) => {
      setRows((prev) => {
        if (prev.length <= 1) {
          alert("至少需保留一列。");
          return prev;
        }
        if (!confirm("確定要移除此列？（含該列所有資料）")) return prev;
        return prev.filter((row) => row.id !== rowId);
      });
    },
    [setRows],
  );

  const contextNoteText = useMemo(() => {
    if (!contextMenu?.noteKey) return "";
    const row = rows.find((r) => r.id === contextMenu.rowId);
    return row?.note ?? "";
  }, [contextMenu, rows]);

  const syncLabel = syncStatusLabel(syncStatus, cloudDirty);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        載入工作資源表…
      </div>
    );
  }

  return (
    <div className="ledger-workspace flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
      <div className="ledger-hero shrink-0 border-b border-slate-200/80 px-3 py-4 sm:px-5 sm:py-5">
        <p className="ledger-hero-kicker text-xs font-semibold uppercase tracking-wider text-emerald-800/80">
          工作資源
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
          資源進出表
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          每日填寫四項數量；
          <strong className="font-semibold text-slate-800">當日用量</strong>
          ＝大機＋細機−試槍−漏油（每列獨立計算，未填為 0）。
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {WORK_RESOURCE_CATEGORIES.map(({ key, label }) => (
            <div
              key={key}
              className="ledger-stat-accent rounded-xl border px-3 py-2.5"
            >
              <p className="text-[11px] font-medium text-slate-500">{label} 本月合計</p>
              <p className="ledger-stat-value mt-0.5 text-lg font-semibold tabular-nums">
                {formatNum(totals[key]) || "0"}
              </p>
            </div>
          ))}
          <div className="col-span-2 rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-3 py-2.5 sm:col-span-1 lg:col-span-2">
            <p className="text-[11px] font-medium text-emerald-800/90">本月用量加總</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-900">
              {formatSigned(totals.totalDailyNet)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div
            className="inline-flex overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm"
            role="group"
            aria-label="切換月份"
          >
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="ledger-touch-btn rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              上個月
            </button>
            <span className="flex min-w-[5.5rem] items-center justify-center border-x border-slate-200/80 px-2 text-sm font-semibold tabular-nums text-slate-900">
              {String(month).padStart(2, "0")}/{year}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="ledger-touch-btn rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              下個月
            </button>
          </div>
        </div>

        {(syncLabel || syncMessage) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {syncLabel ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200/80 bg-white/95 px-3 py-1 text-xs font-medium text-emerald-900">
                {syncLabel}
              </span>
            ) : null}
            {syncMessage ? (
              <span className="text-xs text-amber-800">{syncMessage}</span>
            ) : null}
          </div>
        )}

        <p className="mt-2 text-xs text-slate-600 lg:hidden">
          手機／平板：每日一張卡片；日期旁「列操作」等同右鍵選單。
        </p>
        <p className="mt-2 text-xs text-slate-600">
          <span className="hidden lg:inline">
            右鍵：備註、新增／移除列、清空、WhatsApp／微信匯出。
          </span>
          編輯即存本機。
          {organizationId ? (
            <>
              {" "}
              改動後請按「儲存至 Supabase」；其他裝置約每 30 秒自動更新，或按「從
              Supabase 更新」。
            </>
          ) : (
            <>
              {" "}
              請至{" "}
              <Link href="/settings" className="font-medium text-emerald-800 underline">
                系統設定
              </Link>{" "}
              建立公司後可雲端同步。
            </>
          )}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {organizationId ? (
            <button
              type="button"
              disabled={isSavingCloud}
              onClick={() => void saveToCloud()}
              className="ledger-touch-btn ledger-btn-primary h-11 rounded-xl px-4 text-sm font-semibold shadow-sm disabled:opacity-60"
            >
              {isSavingCloud ? "儲存中…" : "儲存至 Supabase"}
            </button>
          ) : null}
          {organizationId ? (
            <button
              type="button"
              onClick={() => void pullCloudMonth()}
              className="ledger-touch-btn ledger-btn-ghost h-11 rounded-xl px-4 text-sm font-medium shadow-sm"
            >
              從 Supabase 更新
            </button>
          ) : null}
        </div>

        {cloudConflict ? (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
            <p>雲端版本與本機不同，請選擇以雲端合併或先儲存本機覆寫。</p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white"
                onClick={() => void saveToCloud()}
              >
                儲存本機至雲端
              </button>
              <button
                type="button"
                className="rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-medium"
                onClick={applyCloudVersion}
              >
                以雲端合併
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs text-amber-900"
                onClick={dismissCloudConflict}
              >
                稍後
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3 pb-28 sm:p-4 sm:pb-28 lg:p-6 lg:pb-6">
        <div className="lg:hidden">
          <WorkResourceMobileRows
            rows={computed}
            totals={totals}
            formatNum={formatNum}
            parseNum={parseNum}
            updateRow={updateRow}
            updateCount={updateCount}
            openRowMenu={(rowId, el) => openMenuFromAnchor(rowId, el)}
            onNoteContextMenu={openNoteContextMenu}
          />
        </div>

        <div className="hidden lg:block">
          <p className="mb-2 text-center text-xs text-slate-500 xl:hidden">
            ← 左右滑動可查看更多欄位 →
          </p>
          <div className="ledger-table-shell ledger-table-scroll overflow-x-auto overscroll-x-contain rounded-2xl bg-white">
            <table className="w-full min-w-[42rem] border-collapse text-sm">
              <thead>
                <tr className="ledger-thead-row-main">
                  <th className="ledger-th ledger-sticky-col sticky left-0 z-20 min-w-[7.5rem]">
                    日期
                  </th>
                  {WORK_RESOURCE_CATEGORIES.map(({ key, label, sign }) => (
                    <th key={key} className="ledger-th min-w-[4.5rem]">
                      {label}
                      <span className="block text-[10px] font-normal opacity-90">
                        {sign > 0 ? "＋" : "−"}
                      </span>
                    </th>
                  ))}
                  <th className="ledger-th ledger-th-accent min-w-[5.5rem]">
                    當日用量
                    <span className="block text-[10px] font-normal opacity-90">
                      大+細−槍−漏
                    </span>
                  </th>
                  <th className="ledger-th min-w-[8rem]">備註</th>
                </tr>
              </thead>
              <tbody>
                {computed.map((row) => (
                  <tr
                    key={row.id}
                    className="group hover:bg-emerald-50/40"
                    onContextMenu={(e) => openRowContextMenu(e, row.id)}
                  >
                    <td
                      className="ledger-td ledger-sticky-col sticky left-0 z-10 bg-white group-hover:bg-emerald-50/40"
                      onContextMenu={(e) => openRowContextMenu(e, row.id)}
                    >
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) =>
                          updateRow(row.id, { date: e.target.value })
                        }
                        className="ledger-input ledger-touch-input w-full min-w-[7rem] text-left"
                      />
                    </td>
                    {WORK_RESOURCE_CATEGORIES.map(({ key }) => (
                      <td
                        key={`${row.id}-${key}`}
                        className="ledger-td"
                        onContextMenu={(e) => openRowContextMenu(e, row.id)}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatNum(row.counts[key])}
                          placeholder="0"
                          onChange={(e) =>
                            updateCount(row.id, key, parseNum(e.target.value))
                          }
                          className="ledger-input text-right tabular-nums lg:py-2"
                        />
                      </td>
                    ))}
                    <td
                      className="ledger-td computed font-semibold tabular-nums text-emerald-900"
                      onContextMenu={(e) => openRowContextMenu(e, row.id)}
                    >
                      {formatSigned(row.dailyNet)}
                    </td>
                    <td
                      className="ledger-td align-top"
                      onContextMenu={(e) => openNoteContextMenu(e, row.id)}
                    >
                      <textarea
                        value={row.note}
                        rows={1}
                        placeholder="選填"
                        onChange={(e) =>
                          updateRow(row.id, { note: e.target.value })
                        }
                        className="ledger-input min-h-[2rem] resize-y text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="ledger-tfoot-row font-semibold text-slate-900">
                  <td className="ledger-td ledger-tfoot-cell ledger-sticky-col sticky left-0 z-10">
                    本月合計
                  </td>
                  {WORK_RESOURCE_CATEGORIES.map(({ key }) => (
                    <td
                      key={`foot-${key}`}
                      className="ledger-td ledger-tfoot-cell ledger-tfoot-num"
                    >
                      {formatNum(totals[key]) || "0"}
                    </td>
                  ))}
                  <td className="ledger-td ledger-tfoot-cell ledger-tfoot-num ledger-tfoot-accent text-emerald-900">
                    {formatSigned(totals.totalDailyNet)}
                  </td>
                  <td className="ledger-td ledger-tfoot-cell text-xs text-slate-500">
                    加總＝各日用量合計
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <LedgerNoteContextMenu
        menu={contextMenu}
        hasNote={Boolean(contextNoteText.trim())}
        onClose={() => setContextMenu(null)}
        onEdit={() => {
          if (!contextMenu?.noteKey) return;
          setNoteEditor({
            rowId: contextMenu.rowId,
            initialText: contextNoteText,
          });
        }}
        onClearNote={() => {
          if (!contextMenu?.noteKey) return;
          updateRow(contextMenu.rowId, { note: "" });
        }}
        onInsertRow={() => {
          if (!contextMenu) return;
          insertRowAfter(contextMenu.rowId);
        }}
        onRemoveRow={() => {
          if (!contextMenu) return;
          removeRow(contextMenu.rowId);
        }}
        onClearRow={() => {
          if (!contextMenu) return;
          clearRow(contextMenu.rowId);
        }}
        onWhatsAppRow={() => {
          if (!contextMenu) return;
          const row = computed.find((r) => r.id === contextMenu.rowId);
          if (!row) return;
          void (async () => {
            const saved = await persistBeforeShare();
            if (!saved.ok) {
              alert(saved.error);
              return;
            }
            const result = openWhatsAppShare(
              formatWorkResourceRowForWhatsApp(row, companyName),
            );
            if (!result.ok && result.error) alert(result.error);
          })();
        }}
        onWhatsAppMonth={() => {
          void (async () => {
            const saved = await persistBeforeShare();
            if (!saved.ok) {
              alert(saved.error);
              return;
            }
            const result = openWhatsAppShare(
              formatWorkResourceMonthForWhatsApp(
                computed,
                totals,
                year,
                month,
                companyName,
              ),
            );
            if (!result.ok && result.error) alert(result.error);
          })();
        }}
        onWeChatRow={() => {
          if (!contextMenu) return;
          const row = computed.find((r) => r.id === contextMenu.rowId);
          if (!row) return;
          void (async () => {
            const saved = await persistBeforeShare();
            if (!saved.ok) {
              alert(saved.error);
              return;
            }
            const result = await shareViaWeChat(
              formatWorkResourceRowForWhatsApp(row, companyName),
            );
            if (!result.ok && result.error) alert(result.error);
            else alert(weChatShareSuccessMessage(result.mode));
          })();
        }}
        onWeChatMonth={() => {
          void (async () => {
            const saved = await persistBeforeShare();
            if (!saved.ok) {
              alert(saved.error);
              return;
            }
            const result = await shareViaWeChat(
              formatWorkResourceMonthForWhatsApp(
                computed,
                totals,
                year,
                month,
                companyName,
              ),
            );
            if (!result.ok && result.error) alert(result.error);
            else alert(weChatShareSuccessMessage(result.mode));
          })();
        }}
      />

      <LedgerNoteEditor
        open={Boolean(noteEditor)}
        initialText={noteEditor?.initialText ?? ""}
        onClose={() => setNoteEditor(null)}
        onSave={(text) => {
          if (!noteEditor) return;
          updateRow(noteEditor.rowId, { note: text.trim() });
          setNoteEditor(null);
        }}
      />
    </div>
  );
}
