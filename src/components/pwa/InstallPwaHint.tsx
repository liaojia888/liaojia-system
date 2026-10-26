"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPwaHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    try {
      if (localStorage.getItem("pwa-install-dismissed") === "1") {
        setDismissed(true);
      }
    } catch {
      // ignore
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (isStandalone || dismissed || !deferred) return null;

  return (
    <div className="mx-2 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950 shadow-sm sm:mx-0">
      <p className="min-w-0 flex-1">
        可將 <strong>Liaojia 會計</strong>{" "}
        安裝到主畫面，像 App 一樣全螢幕開啟日結表。
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem("pwa-install-dismissed", "1");
            } catch {
              // ignore
            }
          }}
          className="rounded-full px-3 py-1.5 text-slate-600 hover:bg-white/60"
        >
          稍後
        </button>
        <button
          type="button"
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
            setDismissed(true);
          }}
          className="rounded-full bg-emerald-700 px-4 py-1.5 font-medium text-white hover:bg-emerald-800"
        >
          安裝
        </button>
      </div>
    </div>
  );
}
