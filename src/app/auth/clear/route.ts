import { NextResponse, type NextRequest } from "next/server";

/** 清除 Supabase 登入 Cookie，修復 HTTP 431（Header 過大） */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/login?reset=1", request.url),
  );

  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.set(cookie.name, "", {
        path: "/",
        maxAge: 0,
      });
    }
  }

  return response;
}
