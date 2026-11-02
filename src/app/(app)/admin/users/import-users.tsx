"use client";

import { useActionState, useState } from "react";
import { FileUp } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { ModalTrigger } from "@/components/ui/interactive";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Textarea, SubmitButton } from "@/components/ui/form";
import { Badge, Table, td, th } from "@/components/ui/primitives";
import { CopyButton } from "@/components/admin/copy-button";
import { importUsersAction } from "./actions";

type Row = { line: number; email: string; status: "created" | "error"; error?: string; tempPassword?: string };

export function ImportUsersButton({ roles }: { roles: string[] }) {
  const { t } = useI18n();
  return (
    <ModalTrigger label={t("admin.import.button")} title={t("admin.import.title")} variant="outline" icon={<FileUp className="h-4 w-4" />} modalSize="xl">
      {(close) => <ImportFlow roles={roles} close={close} />}
    </ModalTrigger>
  );
}

function ImportFlow({ roles, close }: { roles: string[]; close: () => void }) {
  const [round, setRound] = useState(0);
  return <ImportForm key={round} roles={roles} close={close} again={() => setRound((r) => r + 1)} />;
}

function ImportForm({ roles, close, again }: { roles: string[]; close: () => void; again: () => void }) {
  const { t } = useI18n();
  const [state, action] = useActionState(importUsersAction, null);

  if (state?.ok && state.data?.results) {
    const rows = JSON.parse(state.data.results) as Row[];
    const created = rows.filter((r) => r.status === "created");
    const credentials = created.map((r) => `${r.email},${r.tempPassword}`).join("\n");
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {t("admin.import.summary", { created: created.length, failed: rows.length - created.length })}
        </p>
        {created.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">{t("admin.tempPassword.hint")}</p>}
        <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <Table>
            <thead>
              <tr>
                <th className={th}>#</th>
                <th className={th}>{t("common.email")}</th>
                <th className={th}>{t("common.status")}</th>
                <th className={th}>{t("admin.tempPassword.label")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.line}>
                  <td className={td}>{r.line}</td>
                  <td className={td}>{r.email || "—"}</td>
                  <td className={td}>
                    {r.status === "created" ? (
                      <Badge tone="green">{t("admin.import.created")}</Badge>
                    ) : (
                      <span className="text-xs text-red-600">{t(r.error ?? "common.genericError")}</span>
                    )}
                  </td>
                  <td className={td}>{r.tempPassword ? <code className="font-mono">{r.tempPassword}</code> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {created.length > 0 && <CopyButton value={credentials} label={t("admin.import.copyAll")} size="md" />}
          <Button variant="outline" onClick={again}>
            {t("admin.import.again")}
          </Button>
          <Button onClick={close}>{t("common.close")}</Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        <p>{t("admin.import.help")}</p>
        <pre className="mt-2 overflow-x-auto rounded bg-white p-2 font-mono text-xs dark:bg-slate-900">
          email,firstName,lastName,role,title{"\n"}nizami@example.com,Nizami,Taghizada,MENTOR,Backend Mentor{"\n"}orxan@example.com,Orxan,Əliyev,STAFF,SMM
        </pre>
        <p className="mt-2 text-xs">
          {t("admin.import.allowedRoles")}: <span className="font-mono">{roles.join(", ")}</span>
        </p>
      </div>
      <Field label={t("admin.import.paste")} name="csv" state={state}>
        <Textarea id="csv" name="csv" rows={8} className="font-mono text-xs" placeholder="email,firstName,lastName,role,title" />
      </Field>
      <Field label={t("admin.import.orFile")}>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv,text/plain"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200"
        />
      </Field>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button variant="ghost" onClick={close}>
          {t("common.cancel")}
        </Button>
        <SubmitButton pendingText={t("admin.import.running")}>{t("admin.import.submit")}</SubmitButton>
      </div>
    </form>
  );
}
