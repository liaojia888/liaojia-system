export const COMPANY_DISPLAY_NAME_KEY = "accounting-company-display-name";

export function readLocalCompanyName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(COMPANY_DISPLAY_NAME_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function writeLocalCompanyName(name: string) {
  try {
    localStorage.setItem(COMPANY_DISPLAY_NAME_KEY, name.trim());
  } catch {
    // ignore
  }
}
