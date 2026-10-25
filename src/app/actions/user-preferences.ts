"use server";

import { createClient } from "@/lib/supabase/server";
import {
  APP_THEME_USER_META_KEY,
  isAppThemeId,
  type AppThemeId,
} from "@/lib/app-theme";

export async function saveAppThemeAction(
  theme: AppThemeId,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isAppThemeId(theme)) {
    return { ok: false, error: "無效的主題設定。" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: true };
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      [APP_THEME_USER_META_KEY]: theme,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
