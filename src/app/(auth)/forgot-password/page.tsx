import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { AuthForm, Field } from "@/components/auth/AuthForm";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      title="重設密碼"
      description="我們會寄送安全連結到你的 Email；連結有效時間依 Supabase 設定為準。"
    >
      <AuthForm
        title="忘記密碼"
        subtitle="輸入註冊時的 Email，系統會寄送重設連結"
        action={requestPasswordReset}
        submitLabel="寄送重設連結"
        fields={
          <Field
            label="Email"
            name="email"
            type="email"
            required
            placeholder="name@company.com"
          />
        }
        footer={
          <Link href="/login" className="auth-link font-medium">
            返回登入
          </Link>
        }
      />
    </AuthPageShell>
  );
}
