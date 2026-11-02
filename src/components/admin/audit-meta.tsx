import type { Prisma } from "@prisma/client";

export function AuditMeta({ meta, label = "JSON" }: { meta: Prisma.JsonValue | null; label?: string }) {
  if (meta === null || meta === undefined) return null;
  if (typeof meta === "object" && !Array.isArray(meta) && Object.keys(meta).length === 0) return null;
  const json = JSON.stringify(meta, null, 2);
  const preview = JSON.stringify(meta);
  return (
    <details className="group mt-1 max-w-full">
      <summary className="cursor-pointer list-none truncate text-xs text-slate-500 hover:text-brand-600 [&::-webkit-details-marker]:hidden">
        <span className="mr-1 inline-block transition group-open:rotate-90">▸</span>
        <span className="font-medium">{label}</span> <span className="font-mono opacity-70">{preview.length > 60 ? `${preview.slice(0, 60)}…` : preview}</span>
      </summary>
      <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-slate-50 p-2 font-mono text-xs text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">{json}</pre>
    </details>
  );
}
