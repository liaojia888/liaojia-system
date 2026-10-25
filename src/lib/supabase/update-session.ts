import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { mergeSupabaseCookies } from "@/lib/supabase/response-cookies";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/auth/clear")) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password");

  if (path.startsWith("/reset-password") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/forgot-password";
    return mergeSupabaseCookies(
      supabaseResponse,
      NextResponse.redirect(url),
    );
  }
  const isProtected =
    path.startsWith("/dashboard") ||
    path.startsWith("/reports") ||
    path.startsWith("/settings");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return mergeSupabaseCookies(
      supabaseResponse,
      NextResponse.redirect(url),
    );
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return mergeSupabaseCookies(
      supabaseResponse,
      NextResponse.redirect(url),
    );
  }

  return supabaseResponse;
}
