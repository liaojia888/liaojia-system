import Link from "next/link";
import { signIn } from "@/app/actions/auth";
import { AuthEmailHelp } from "@/components/auth/AuthEmailHelp";
import { AuthForm, Field } from "@/components/auth/AuthForm";
import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string; redirect?: string }>;
}) {
  const params = await searchParams;
  const redirectPath =
    params.redirect?.startsWith("/") && !params.redirect.startsWith("//")
      ? params.redirect
      : "";

  return (
    <>
      {params.reset === "1" ? (
        <p className="mx-auto mb-4 max-w-md rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          已清除本機登入 Cookie，請重新登入。
        </p>
      ) : null}
      {params.error === "auth_callback" ? (
        <p className="mx-auto mb-4 max-w-md rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Email 驗證連結無效或已過期，請重新註冊或聯絡管理員在 Supabase 手動確認 Email。
        </p>
      ) : null}
      <AuthEmailHelp variant="login" />
      <ResendVerificationForm />
    <AuthForm
      title="登入"
      subtitle="使用您的帳號進入會計管理系統"
      action={signIn}
      submitLabel="登入"
      fields={
        <>
          {redirectPath ? (
            <input type="hidden" name="redirect" value={redirectPath} />
          ) : null}
          <Field label="Email" name="email" type="email" required />
          <Field label="密碼" name="password" type="password" required />
        </>
      }
      footer={
        <div className="space-y-2 text-slate-600">
          <p>
            還沒有帳號？{" "}
            <Link href="/signup" className="font-medium text-slate-900 underline">
              註冊
            </Link>
          </p>
          <p>
            忘記密碼？{" "}
            <Link
              href="/forgot-password"
              className="font-medium text-slate-900 underline"
            >
              寄重設連結到 Email
            </Link>
          </p>
        </div>
      }
    />
    </>
  );
}
