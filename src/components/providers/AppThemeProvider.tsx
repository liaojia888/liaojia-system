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
import { saveAppThemeAction } from "@/app/actions/user-preferences";
import {
  applyAppThemeToDocument,
  DEFAULT_APP_THEME,
  readStoredAppTheme,
  writeStoredAppTheme,
  type AppThemeId,
} from "@/lib/app-theme";

type AppThemeContextValue = {
  theme: AppThemeId;
  setTheme: (theme: AppThemeId) => void;
  ready: boolean;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({
  children,
  initialThemeFromAccount,
}: {
  children: React.ReactNode;
  initialThemeFromAccount?: AppThemeId | null;
}) {
  const [theme, setThemeState] = useState<AppThemeId>(DEFAULT_APP_THEME);
  const [ready, setReady] = useState(false);
  const saveTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const local = readStoredAppTheme();
    const resolved = initialThemeFromAccount ?? local;
    setThemeState(resolved);
    applyAppThemeToDocument(resolved);
    writeStoredAppTheme(resolved);
    setReady(true);
  }, [initialThemeFromAccount]);

  useEffect(() => {
    if (!ready) return;
    applyAppThemeToDocument(theme);
    writeStoredAppTheme(theme);

    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void saveAppThemeAction(theme);
    }, 400);
  }, [theme, ready]);

  useEffect(
    () => () => {
      window.clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const setTheme = useCallback((next: AppThemeId) => {
    setThemeState(next);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, ready }),
    [theme, setTheme, ready],
  );

  return (
    <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return ctx;
}
