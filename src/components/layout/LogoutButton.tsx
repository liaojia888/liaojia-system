"use client";

import { signOut } from "@/app/actions/auth";

export function LogoutButton({
  className,
  label = "登出",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <form action={signOut} className="inline-flex">
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
