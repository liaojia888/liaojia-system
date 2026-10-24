/** Supabase 儀表板可能顯示 anon key（JWT）或 publishable key（sb_publishable_…） */
export function getSupabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!key) {
    throw new Error(
      "請在 .env.local 設定 NEXT_PUBLIC_SUPABASE_ANON_KEY 或 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  return key;
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("請在 .env.local 設定 NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}
