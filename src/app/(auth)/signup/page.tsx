import Link from "next/link";
import { signUp } from "@/app/actions/auth";
import { AuthForm, Field } from "@/components/auth/AuthForm";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

export default function SignUpPage() {
  return (
    <AuthPageShell
      title="建立你的公司帳號"
      description="註冊後可立即使用日結表；若 Supabase 開啟 Email 確認，請至信箱完成驗證再登入。"
    >
      <AuthForm
        title="註冊"
        subtitle="填寫基本資料，首次登入會建立公司與預設會計科目"
        action={signUp}
        submitLabel="註冊並開始使用"
        fields={
          <>
            <Field label="姓名" name="fullName" placeholder="王小明" />
            <Field label="公司名稱" name="orgName" placeholder="範例股份有限公司" />
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
              placeholder="至少 6 個字元"
            />
          </>
        }
        footer={
          <p className="text-slate-600">
            已有帳號？{" "}
            <Link href="/login" className="auth-link font-semibold">
              返回登入
            </Link>
          </p>
        }
      />
    </AuthPageShell>
  );
}
