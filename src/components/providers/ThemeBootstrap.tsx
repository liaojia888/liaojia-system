"use client";

import { useLayoutEffect } from "react";
import {
  applyAppThemeToDocument,
  readStoredAppTheme,
} from "@/lib/app-theme";

/** 模組載入時先套用本機主題（早於首屏 paint 的 useLayoutEffect） */
if (typeof window !== "undefined") {
  applyAppThemeToDocument(readStoredAppTheme());
}

/** 避免在 layout 使用 inline script（Next.js 16 client 不執行） */
export function ThemeBootstrap() {
  useLayoutEffect(() => {
    applyAppThemeToDocument(readStoredAppTheme());
  }, []);

  return null;
}
