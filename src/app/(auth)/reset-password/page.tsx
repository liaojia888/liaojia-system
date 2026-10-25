import Link from "next/link";
import { updatePassword } from "@/app/actions/auth";
import { AuthForm, Field } from "@/components/auth/AuthForm";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

export default function ResetPasswordPage() {
  return (
    <AuthPageShell title="設定新密碼" description="完成後會自動登入並前往日結工作台。">
      <AuthForm
        title="設定新密碼"
        subtitle="請輸入新的登入密碼（至少 6 個字元）"
        action={updatePassword}
        submitLabel="更新密碼並登入"
        fields={
          <>
            <Field label="新密碼" name="password" type="password" required />
            <Field
              label="確認新密碼"
              name="confirmPassword"
              type="password"
              required
            />
          </>
        }
        footer={
          <p className="text-slate-600">
            連結失效？{" "}
            <Link href="/forgot-password" className="auth-link font-semibold">
              重新申請
            </Link>
          </p>
        }
      />
    </AuthPageShell>
  );
}
