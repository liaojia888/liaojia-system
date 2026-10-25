import { headers } from "next/headers";

export async function getRequestClientKey(scope: string): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "local";
  return `${scope}:${ip}`;
}
