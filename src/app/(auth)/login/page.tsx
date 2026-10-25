import Link from "next/link";
import { signIn } from "@/app/actions/auth";
import { AuthAlert, AuthForm, Field } from "@/components/auth/AuthForm";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { LoginSupportPanel } from "@/components/auth/LoginSupportPanel";

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
    <AuthPageShell
      title="登入，開始對帳"
      description="同一帳號可在公司電腦、手機與 Vercel 線上版使用；日結資料可同步雲端。"
    >
      {params.reset === "1" ? (
        <AuthAlert variant="success">已清除本機登入 Cookie，請重新登入。</AuthAlert>
      ) : null}
      {params.error === "auth_callback" ? (
        <AuthAlert variant="warning">
          Email 驗證連結無效或已過期。請使用下方「收不到驗證信」重寄，或聯絡管理員在
          Supabase 確認 Email。
        </AuthAlert>
      ) : null}

      <AuthForm
        title="登入"
        subtitle="使用 Email 與密碼進入日結工作台"
        action={signIn}
        submitLabel="登入"
        fields={
          <>
            {redirectPath ? (
              <input type="hidden" name="redirect" value={redirectPath} />
            ) : null}
            <Field
              label="Email"
              name="email"
              type="email"
              required
              placeholder="name@company.com"
            />
            <Field
              label="密碼"
              name="password"
              type="password"
              required
              placeholder="••••••••"
            />
          </>
        }
        footer={
          <div className="flex flex-col gap-3 text-slate-600">
            <p>
              還沒有帳號？{" "}
              <Link href="/signup" className="auth-link font-semibold">
                免費註冊
              </Link>
            </p>
            <p>
              <Link href="/forgot-password" className="auth-link">
                忘記密碼
              </Link>
            </p>
          </div>
        }
      />

      <LoginSupportPanel />
    </AuthPageShell>
  );
}
