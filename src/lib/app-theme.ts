export const APP_THEME_STORAGE_KEY = "accounting-app-theme";
/** Supabase Auth user_metadata 欄位 */
export const APP_THEME_USER_META_KEY = "app_theme";

export type AppThemeId =
  | "emerald"
  | "ocean"
  | "violet"
  | "sunset"
  | "graphite";

export type AppThemeOption = {
  id: AppThemeId;
  name: string;
  description: string;
  preview: [string, string, string, string];
};

export const APP_THEME_OPTIONS: AppThemeOption[] = [
  {
    id: "emerald",
    name: "翡翠商務",
    description: "經典會計綠，清晰專業",
    preview: ["#0b1f18", "#217346", "#ecfdf5", "#6ee7b7"],
  },
  {
    id: "ocean",
    name: "海洋靛藍",
    description: "冷色調、沉穩現代",
    preview: ["#0a1628", "#2563eb", "#eff6ff", "#93c5fd"],
  },
  {
    id: "violet",
    name: "暮光紫韻",
    description: "柔和高級、偏時尚",
    preview: ["#150d28", "#7c3aed", "#f5f3ff", "#c4b5fd"],
  },
  {
    id: "sunset",
    name: "暖陽琥珀",
    description: "暖色活力、易讀",
    preview: ["#221108", "#ea580c", "#fff7ed", "#fdba74"],
  },
  {
    id: "graphite",
    name: "石墨極簡",
    description: "低彩度、極簡專注",
    preview: ["#1a1f26", "#475569", "#f8fafc", "#cbd5e1"],
  },
];

export const DEFAULT_APP_THEME: AppThemeId = "emerald";

export function isAppThemeId(value: string): value is AppThemeId {
  return APP_THEME_OPTIONS.some((t) => t.id === value);
}

export function themeFromUserMetadata(
  metadata: Record<string, unknown> | undefined,
): AppThemeId | null {
  const raw = metadata?.[APP_THEME_USER_META_KEY];
  if (typeof raw === "string" && isAppThemeId(raw)) return raw;
  return null;
}

export function readStoredAppTheme(): AppThemeId {
  if (typeof window === "undefined") return DEFAULT_APP_THEME;
  try {
    const raw = localStorage.getItem(APP_THEME_STORAGE_KEY);
    if (raw && isAppThemeId(raw)) return raw;
  } catch {
    // ignore
  }
  return DEFAULT_APP_THEME;
}

export function writeStoredAppTheme(theme: AppThemeId) {
  try {
    localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function applyAppThemeToDocument(theme: AppThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.appTheme = theme;
}
