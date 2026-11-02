"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { activatePackAction, exitPreviewAction } from "@/app/(app)/admin/appearance/actions";

// shown only to the admin who is trying a theme before activating it
export function PreviewBanner({ packId, name }: { packId: string; name: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg dark:border-amber-500/40 dark:bg-amber-950/90 dark:text-amber-100">
      <Eye className="h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1">{t("admin.appearance.packs.previewing", { name })}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await exitPreviewAction();
              router.push("/admin/appearance");
            })
          }
          className="rounded-lg px-3 py-1.5 font-medium hover:bg-amber-100 dark:hover:bg-amber-900"
        >
          {t("admin.appearance.packs.exitPreview")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await activatePackAction(packId);
              router.refresh();
            })
          }
          className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-amber-950 hover:bg-amber-400"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("admin.appearance.packs.activate")}
        </button>
      </div>
    </div>
  );
}
