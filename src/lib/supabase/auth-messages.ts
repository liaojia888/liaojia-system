export function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("email not confirmed")) {
    return "Email 尚未驗證。請到信箱（含垃圾郵件）點擊 Supabase 寄出的確認連結，再重新登入。";
  }
  if (normalized.includes("invalid login credentials")) {
    return "Email 或密碼錯誤，請再試一次。";
  }
  if (normalized.includes("user already registered")) {
    return "此 Email 已註冊，請直接登入。";
  }

  return message;
}
