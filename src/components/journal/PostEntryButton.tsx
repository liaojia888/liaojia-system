"use client";

import { useState, useTransition } from "react";
import { postJournalEntry } from "@/app/actions/journal";

export function PostEntryButton({ entryId }: { entryId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await postJournalEntry(entryId);
            setError(result.error);
          });
        }}
        className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending ? "過帳中…" : "過帳"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
