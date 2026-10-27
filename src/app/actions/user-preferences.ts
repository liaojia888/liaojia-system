"use server";

import { createClient } from "@/lib/supabase/server";
import {
  APP_THEME_USER_META_KEY,
  isAppThemeId,
  type AppThemeId,
} from "@/lib/app-theme";
import {
  LEDGER_LAYOUT_USER_META_KEY,
  isLedgerLayoutId,
  type LedgerLayoutId,
} from "@/lib/ledger-layout";

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

export async function saveLedgerLayoutAction(
  layout: LedgerLayoutId,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isLedgerLayoutId(layout)) {
    return { ok: false, error: "無效的日結介面設定。" };
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
      [LEDGER_LAYOUT_USER_META_KEY]: layout,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
