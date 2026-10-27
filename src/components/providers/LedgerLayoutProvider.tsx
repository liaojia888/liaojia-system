"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { saveLedgerLayoutAction } from "@/app/actions/user-preferences";
import {
  DEFAULT_LEDGER_LAYOUT,
  readStoredLedgerLayout,
  writeStoredLedgerLayout,
  type LedgerLayoutId,
} from "@/lib/ledger-layout";

type LedgerLayoutContextValue = {
  layout: LedgerLayoutId;
  setLayout: (layout: LedgerLayoutId) => void;
  ready: boolean;
};

const LedgerLayoutContext = createContext<LedgerLayoutContextValue | null>(
  null,
);

export function LedgerLayoutProvider({
  children,
  initialLayoutFromAccount,
}: {
  children: React.ReactNode;
  initialLayoutFromAccount?: LedgerLayoutId | null;
}) {
  const [layout, setLayoutState] = useState<LedgerLayoutId>(
    DEFAULT_LEDGER_LAYOUT,
  );
  const [ready, setReady] = useState(false);
  const saveTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const local = readStoredLedgerLayout();
    const resolved = initialLayoutFromAccount ?? local;
    setLayoutState(resolved);
    writeStoredLedgerLayout(resolved);
    setReady(true);
  }, [initialLayoutFromAccount]);

  useEffect(() => {
    if (!ready) return;
    writeStoredLedgerLayout(layout);
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void saveLedgerLayoutAction(layout).catch(() => {});
    }, 400);
  }, [layout, ready]);

  useEffect(
    () => () => {
      window.clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const setLayout = useCallback((next: LedgerLayoutId) => {
    setLayoutState(next);
  }, []);

  const value = useMemo(
    () => ({ layout, setLayout, ready }),
    [layout, setLayout, ready],
  );

  return (
    <LedgerLayoutContext.Provider value={value}>
      {children}
    </LedgerLayoutContext.Provider>
  );
}

export function useLedgerLayout() {
  const ctx = useContext(LedgerLayoutContext);
  if (!ctx) {
    throw new Error("useLedgerLayout must be used within LedgerLayoutProvider");
  }
  return ctx;
}
