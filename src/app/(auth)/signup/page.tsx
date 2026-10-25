import Link from "next/link";
import { signUp } from "@/app/actions/auth";
import { AuthEmailHelp } from "@/components/auth/AuthEmailHelp";
import { AuthForm, Field } from "@/components/auth/AuthForm";

export default function SignUpPage() {
  return (
    <>
      <AuthEmailHelp variant="signup" />
    <AuthForm
      title="建立帳號"
      subtitle="註冊後會自動建立公司與預設會計科目"
      action={signUp}
      submitLabel="註冊並開始使用"
      fields={
        <>
          <Field label="姓名" name="fullName" placeholder="王小明" />
          <Field label="公司名稱" name="orgName" placeholder="範例股份有限公司" />
          <Field label="Email" name="email" type="email" required />
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
          <Link href="/login" className="font-medium text-slate-900 underline">
            登入
          </Link>
        </p>
      }
    />
    </>
  );
}
