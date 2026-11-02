"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action";
import { sendDecisionsAction } from "./actions";

export function SendDecisionsButton({ formId, pending }: { formId: string; pending: number }) {
  const { t } = useI18n();
  const [busy, start] = useTransition();
  const [result, setResult] = useState<ActionState>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <Button
        variant="outline"
        size="sm"
        disabled={busy || pending === 0}
        onClick={() => {
          if (!window.confirm(t("applications.responses.sendDecisionsConfirm", { n: pending }))) return;
          setResult(null);
          start(async () => setResult(await sendDecisionsAction(formId)));
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {t("applications.responses.sendDecisions", { n: pending })}
      </Button>
      {result && (
        <span className={`mt-1 text-xs font-medium ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
          {t((result.ok ? result.message : result.error) ?? "", result.data)}
        </span>
      )}
    </span>
  );
}
