import { NextResponse } from "next/server";

/** 將 Supabase middleware 刷新後的 cookie 複製到 redirect 等回應（避免登入狀態遺失） */
export function mergeSupabaseCookies(
  from: NextResponse,
  to: NextResponse,
): NextResponse {
  from.cookies.getAll().forEach(({ name, value }) => {
    to.cookies.set(name, value);
  });
  return to;
}
