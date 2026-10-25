import { LEDGER_STORAGE_KEY } from "@/lib/daily-ledger";

export const LEDGER_SYNC_CHANNEL = "accounting-ledger-sync";

export type LedgerSyncMessage = {
  type: "month-updated";
  monthKey: string;
};

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return null;
  }
  if (!channel) {
    channel = new BroadcastChannel(LEDGER_SYNC_CHANNEL);
  }
  return channel;
}

/** 通知其他分頁／同頁 listener：某月本機日結已更新 */
export function broadcastLedgerMonthUpdated(monthKey: string) {
  const msg: LedgerSyncMessage = { type: "month-updated", monthKey };
  getChannel()?.postMessage(msg);
}

export function subscribeLedgerSync(
  onMessage: (msg: LedgerSyncMessage) => void,
): () => void {
  const bc = getChannel();
  const handler = (event: MessageEvent<LedgerSyncMessage>) => {
    if (event.data?.type === "month-updated" && event.data.monthKey) {
      onMessage(event.data);
    }
  };
  bc?.addEventListener("message", handler);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== LEDGER_STORAGE_KEY || !event.newValue) return;
    try {
      const all = JSON.parse(event.newValue) as Record<
        string,
        { monthKey?: string }
      >;
      for (const key of Object.keys(all)) {
        onMessage({ type: "month-updated", monthKey: key });
      }
    } catch {
      // ignore
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    bc?.removeEventListener("message", handler);
    window.removeEventListener("storage", onStorage);
  };
}
