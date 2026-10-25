"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureOrganizationForUser } from "@/lib/organization";
import { getAppUrl } from "@/lib/app-url";
import { translateAuthError } from "@/lib/supabase/auth-messages";
import {
  checkRateLimit,
  rateLimitMessage,
} from "@/lib/rate-limit";
import { getRequestClientKey } from "@/lib/request-client-key";

const AUTH_WINDOW_MS = 15 * 60 * 1000;

export async function signIn(
  _prev: { error: string | null; notice: string | null } | void,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const clientKey = await getRequestClientKey("sign-in");
  const limited = checkRateLimit(
    `${clientKey}:${email.toLowerCase()}`,
    12,
    AUTH_WINDOW_MS,
  );
  if (!limited.ok) {
    return { error: rateLimitMessage(limited.retryAfterSec), notice: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: translateAuthError(error.message), notice: null };
  }

  // 確保 session 寫入 cookie（Server Action 內）
  await supabase.auth.getUser();

  await ensureOrganizationForUser("我的公司");
  revalidatePath("/", "layout");

  const redirectTo = String(formData.get("redirect") ?? "").trim();
  const safeRedirect =
    redirectTo.startsWith("/") &&
    !redirectTo.startsWith("//") &&
    !redirectTo.startsWith("/login")
      ? redirectTo
      : "/dashboard";

  redirect(safeRedirect);
}

export async function signUp(
  _prev: { error: string | null; notice: string | null } | void,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const orgName = String(formData.get("orgName") ?? "").trim() || "我的公司";

  const clientKey = await getRequestClientKey("sign-up");
  const limited = checkRateLimit(`${clientKey}:${email.toLowerCase()}`, 6, AUTH_WINDOW_MS);
  if (!limited.ok) {
    return { error: rateLimitMessage(limited.retryAfterSec), notice: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${getAppUrl()}/auth/callback`,
    },
  });

  if (error) {
    return { error: translateAuthError(error.message), notice: null };
  }

  // 若 Supabase 開啟「Email 確認」，註冊後不會有 session，需先驗證信箱
  if (!data.session) {
    return {
      error: null,
      notice:
        "註冊成功！請至 Email 信箱（含垃圾郵件）點擊驗證連結，完成後再到登入頁登入。首次登入會自動建立公司與會計科目。",
    };
  }

  const { organizationId, error: orgError } =
    await ensureOrganizationForUser(orgName);

  if (orgError && !organizationId) {
    return { error: orgError, notice: null };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function requestPasswordReset(
  _prev: { error: string | null; notice: string | null } | void,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "請輸入 Email。", notice: null };
  }

  const clientKey = await getRequestClientKey("password-reset");
  const limited = checkRateLimit(
    `${clientKey}:${email.toLowerCase()}`,
    5,
    AUTH_WINDOW_MS,
  );
  if (!limited.ok) {
    return { error: rateLimitMessage(limited.retryAfterSec), notice: null };
  }

  const supabase = await createClient();
  const redirectTo = `${getAppUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return { error: translateAuthError(error.message), notice: null };
  }

  return {
    error: null,
    notice:
      "若此 Email 已註冊，您會收到重設密碼信件（請一併查看垃圾郵件）。點擊連結後可設定新密碼。",
  };
}

export async function updatePassword(
  _prev: { error: string | null; notice: string | null } | void,
  formData: FormData,
) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (password.length < 6) {
    return { error: "密碼至少 6 個字元。", notice: null };
  }
  if (password !== confirm) {
    return { error: "兩次輸入的密碼不一致。", notice: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "連結已失效或未登入，請至「忘記密碼」重新申請。",
      notice: null,
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: translateAuthError(error.message), notice: null };
  }

  await ensureOrganizationForUser("我的公司");
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function resendVerificationEmail(
  _prev: { error: string | null; notice: string | null } | void,
  formData: FormData,
) {
  const emailFromForm = String(formData.get("email") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = emailFromForm || user?.email || "";
  if (!email) {
    return { error: "請輸入 Email。", notice: null };
  }

  const clientKey = await getRequestClientKey("resend-verify");
  const limited = checkRateLimit(
    `${clientKey}:${email.toLowerCase()}`,
    3,
    AUTH_WINDOW_MS,
  );
  if (!limited.ok) {
    return { error: rateLimitMessage(limited.retryAfterSec), notice: null };
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${getAppUrl()}/auth/callback`,
    },
  });

  if (error) {
    return { error: translateAuthError(error.message), notice: null };
  }

  return {
    error: null,
    notice:
      "已重新寄出驗證信（若帳號存在且尚未驗證）。請查看收件匣與垃圾郵件，並在 Supabase 設定的有效時間內點擊連結。",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
