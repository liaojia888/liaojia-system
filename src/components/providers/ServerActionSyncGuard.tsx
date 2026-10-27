"use client";

import { useEffect } from "react";

const SESSION_FLAG = "ams-server-action-reload";

function isStaleServerActionError(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  const name = "name" in reason ? String(reason.name) : "";
  const message =
    "message" in reason ? String((reason as { message: unknown }).message) : "";
  return (
    name === "UnrecognizedActionError" ||
    message.includes("Server Action") ||
    message.includes("failed-to-find-server-action")
  );
}

/**
 * 刪除 .next 或重新 build 後，瀏覽器可能仍快取舊 JS 內的 Action ID。
 * 偵測到一次後自動重新載入，讓 HTML 與 chunk 對齊。
 */
export function ServerActionSyncGuard() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isStaleServerActionError(event.reason)) return;
      if (sessionStorage.getItem(SESSION_FLAG) === "1") return;

      sessionStorage.setItem(SESSION_FLAG, "1");
      window.location.reload();
    };

    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      sessionStorage.removeItem(SESSION_FLAG);
    }, 30_000);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
