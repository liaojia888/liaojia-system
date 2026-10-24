"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { createJournalEntry } from "@/app/actions/journal";
import type { Account } from "@/types/database";

type DraftLine = {
  accountId: string;
  debit: string;
  credit: string;
  memo: string;
};

const emptyLine = (): DraftLine => ({
  accountId: "",
  debit: "",
  credit: "",
  memo: "",
});

export function JournalEntryForm({ accounts }: { accounts: Account[] }) {
  const [lines, setLines] = useState<DraftLine[]>([
    emptyLine(),
    emptyLine(),
  ]);
  const [state, formAction, pending] = useActionState(createJournalEntry, {
    error: null as string | null,
  });

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const line of lines) {
      debit += Number(line.debit) || 0;
      credit += Number(line.credit) || 0;
    }
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.001 };
  }, [lines]);

  const linesPayload = JSON.stringify(
    lines.map((l) => ({
      accountId: l.accountId,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      memo: l.memo || undefined,
    })),
  );

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">日期</span>
          <input
            type="date"
            name="entryDate"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="mb-1 block font-medium">摘要</span>
          <input
            name="description"
            required
            placeholder="例如：支付辦公室租金"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm md:col-span-3">
          <span className="mb-1 block font-medium">參考編號（選填）</span>
          <input
            name="reference"
            placeholder="INV-001"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <input type="hidden" name="lines" value={linesPayload} readOnly />

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">科目</th>
              <th className="px-3 py-2 font-medium">借方</th>
              <th className="px-3 py-2 font-medium">貸方</th>
              <th className="px-3 py-2 font-medium">備註</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="border-t border-slate-100">
                <td className="px-2 py-2">
                  <select
                    value={line.accountId}
                    onChange={(e) =>
                      updateLine(index, { accountId: e.target.value })
                    }
                    className="w-full min-w-[180px] rounded border border-slate-300 px-2 py-1.5"
                  >
                    <option value="">選擇科目</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={line.debit}
                    onChange={(e) =>
                      updateLine(index, {
                        debit: e.target.value,
                        credit: e.target.value ? "" : line.credit,
                      })
                    }
                    className="w-28 rounded border border-slate-300 px-2 py-1.5"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={line.credit}
                    onChange={(e) =>
                      updateLine(index, {
                        credit: e.target.value,
                        debit: e.target.value ? "" : line.debit,
                      })
                    }
                    className="w-28 rounded border border-slate-300 px-2 py-1.5"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    value={line.memo}
                    onChange={(e) =>
                      updateLine(index, { memo: e.target.value })
                    }
                    className="w-full min-w-[120px] rounded border border-slate-300 px-2 py-1.5"
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      setLines((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="text-slate-500 hover:text-red-600"
                    disabled={lines.length <= 2}
                  >
                    刪
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50">
            <tr>
              <td className="px-3 py-2 font-medium">合計</td>
              <td className="px-3 py-2">{totals.debit.toLocaleString()}</td>
              <td className="px-3 py-2">{totals.credit.toLocaleString()}</td>
              <td colSpan={2} className="px-3 py-2">
                {totals.balanced ? (
                  <span className="text-emerald-700">借貸平衡</span>
                ) : (
                  <span className="text-amber-700">借貸尚未平衡</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
        >
          新增分錄列
        </button>
        <button
          type="submit"
          disabled={pending || !totals.balanced}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "儲存中…" : "儲存草稿傳票"}
        </button>
        {state?.error ? (
          <span className="text-sm text-red-600">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}
