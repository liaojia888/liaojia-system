import Link from "next/link";
import { updatePassword } from "@/app/actions/auth";
import { AuthForm, Field } from "@/components/auth/AuthForm";

export default function ResetPasswordPage() {
  return (
    <AuthForm
      title="設定新密碼"
      subtitle="請輸入新的登入密碼"
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
          <Link
            href="/forgot-password"
            className="font-medium text-slate-900 underline"
          >
            重新申請
          </Link>
        </p>
      }
    />
  );
}
