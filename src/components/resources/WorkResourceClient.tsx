"use client";

import dynamic from "next/dynamic";

const WorkResourceSheet = dynamic(
  () =>
    import("@/components/resources/WorkResourceSheet").then(
      (m) => m.WorkResourceSheet,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        載入工作資源表…
      </div>
    ),
  },
);

export function WorkResourceClient({
  organizationId,
}: {
  organizationId: string | null;
}) {
  return <WorkResourceSheet organizationId={organizationId} />;
}
