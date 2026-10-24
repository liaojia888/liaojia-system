"use client";

import { useEffect, useRef } from "react";
import type { LedgerNoteKey } from "@/lib/daily-ledger";

export type NoteTarget = {
  rowId: string;
  noteKey: LedgerNoteKey;
};

export type ContextMenuState = {
  rowId: string;
  /** 金額格右鍵時帶入；日期格右鍵僅清空這行則可省略 */
  noteKey?: LedgerNoteKey;
  x: number;
  y: number;
};

export function LedgerNoteContextMenu({
  menu,
  hasNote,
  onEdit,
  onClearNote,
  onInsertRow,
  onRemoveRow,
  onClearRow,
  onWhatsAppRow,
  onWhatsAppMonth,
  onClose,
}: {
  menu: ContextMenuState | null;
  hasNote: boolean;
  onEdit: () => void;
  onClearNote: () => void;
  onInsertRow: () => void;
  onRemoveRow: () => void;
  onClearRow: () => void;
  onWhatsAppRow: () => void;
  onWhatsAppMonth: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  const showNoteActions = Boolean(menu.noteKey);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[9rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
    >
      {showNoteActions ? (
        <>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
            onClick={() => {
              onEdit();
              onClose();
            }}
          >
            {hasNote ? "編輯備註" : "新增備註"}
          </button>
          {hasNote ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
              onClick={() => {
                onClearNote();
                onClose();
              }}
            >
              清除備註
            </button>
          ) : null}
        </>
      ) : null}
      {showNoteActions ? (
        <div className="my-1 border-t border-slate-100" role="separator" />
      ) : null}
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
        onClick={() => {
          onInsertRow();
          onClose();
        }}
      >
        新增列
      </button>
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
        onClick={() => {
          onRemoveRow();
          onClose();
        }}
      >
        移除列
      </button>
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
        onClick={() => {
          onClearRow();
          onClose();
        }}
      >
        清空這行
      </button>
      <div className="my-1 border-t border-slate-100" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2 text-left text-sm text-emerald-800 hover:bg-emerald-50"
        onClick={() => {
          onWhatsAppRow();
          onClose();
        }}
      >
        WhatsApp 匯出此列
      </button>
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2 text-left text-sm text-emerald-800 hover:bg-emerald-50"
        onClick={() => {
          onWhatsAppMonth();
          onClose();
        }}
      >
        WhatsApp 匯出本月
      </button>
    </div>
  );
}

export function LedgerNoteEditor({
  open,
  initialText,
  onSave,
  onClose,
}: {
  open: boolean;
  initialText: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        role="dialog"
        aria-labelledby="note-editor-title"
      >
        <h2 id="note-editor-title" className="text-base font-semibold text-slate-900">
          儲存格備註
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          右鍵可再次開啟；滑鼠移入儲存格可預覽，或使用「全部顯示備註」。
        </p>
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const text = textareaRef.current?.value ?? "";
            onSave(text);
          }}
        >
          <textarea
            ref={textareaRef}
            defaultValue={initialText}
            rows={4}
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="輸入備註內容…"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              儲存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
