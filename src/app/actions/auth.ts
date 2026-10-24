"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureOrganizationForUser } from "@/lib/organization";
import { getAppUrl } from "@/lib/app-url";
import { translateAuthError } from "@/lib/supabase/auth-messages";

export async function signIn(
  _prev: { error: string | null; notice: string | null } | void,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: translateAuthError(error.message), notice: null };
  }

  await ensureOrganizationForUser("我的公司");
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUp(
  _prev: { error: string | null; notice: string | null } | void,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const orgName = String(formData.get("orgName") ?? "").trim() || "我的公司";

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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
