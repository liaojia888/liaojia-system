import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { AuthForm, Field } from "@/components/auth/AuthForm";

export default function ForgotPasswordPage() {
  return (
    <AuthForm
      title="忘記密碼"
      subtitle="輸入註冊時的 Email，我們會寄送重設密碼連結"
      action={requestPasswordReset}
      submitLabel="寄送重設連結"
      fields={
        <Field
          label="Email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
        />
      }
      footer={
        <p className="text-slate-600">
          <Link href="/login" className="font-medium text-slate-900 underline">
            返回登入
          </Link>
        </p>
      }
    />
  );
}
