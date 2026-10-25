"use client";

import { APP_THEME_OPTIONS } from "@/lib/app-theme";
import { useAppTheme } from "@/components/providers/AppThemeProvider";

export function AppearanceSettings() {
  const { theme, setTheme } = useAppTheme();

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">外觀主題</h2>
      <p className="mt-1 text-sm text-slate-600">
        選擇日結表與工作台配色；已登入時會同步至 Supabase 帳號（換裝置也會套用），並保留本機快取。
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {APP_THEME_OPTIONS.map((option) => {
          const selected = theme === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => setTheme(option.id)}
                className={`group flex w-full flex-col overflow-hidden rounded-xl border text-left transition-all duration-200 ${
                  selected
                    ? "border-[var(--theme-accent)] ring-2 ring-[var(--theme-accent)]/30 shadow-md"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className="flex h-16 items-stretch overflow-hidden">
                  <span
                    className="w-[22%] shrink-0"
                    style={{ backgroundColor: option.preview[0] }}
                    title="側邊欄"
                  />
                  <span
                    className="flex-1"
                    style={{ backgroundColor: option.preview[1] }}
                    title="主色"
                  />
                  <span
                    className="flex-1"
                    style={{ backgroundColor: option.preview[2] }}
                    title="背景"
                  />
                  <span
                    className="w-[18%] shrink-0 border-l border-white/25"
                    style={{ backgroundColor: option.preview[3] }}
                    title="強調色"
                  />
                </div>
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">
                      {option.name}
                    </span>
                    {selected ? (
                      <span className="rounded-full bg-[var(--theme-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--theme-accent-strong)]">
                        使用中
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {option.description}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
