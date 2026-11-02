"use client";

import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold">{t("common.errorTitle")}</h1>
      <p className="mt-2 text-slate-500">{t("common.errorText")}</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-slate-400">{error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
