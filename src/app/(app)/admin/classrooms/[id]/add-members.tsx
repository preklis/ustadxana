"use client";

import { useEffect, useState, useTransition } from "react";
import type { ClassroomRole } from "@prisma/client";
import { Loader2, Search, UserPlus } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn, fullName } from "@/lib/utils";
import { Avatar } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/interactive";
import { Input } from "@/components/ui/form";
import type { ActionState } from "@/lib/action";
import { addMembersAction, searchCandidatesAction, type Candidate } from "../actions";

const ROLES: ClassroomRole[] = ["STUDENT", "MENTOR", "STAFF"];

export function AddMembersButton({ classroomId, initialRole = "STUDENT" }: { classroomId: string; initialRole?: ClassroomRole }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const close = () => {
    setOpen(false);
    setRound((r) => r + 1);
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        {t("admin.members.add")}
      </Button>
      <Modal open={open} onClose={close} title={t("admin.members.addTitle")} size="lg">
        <AddMembersPanel key={round} classroomId={classroomId} initialRole={initialRole} close={close} />
      </Modal>
    </>
  );
}

function AddMembersPanel({ classroomId, initialRole, close }: { classroomId: string; initialRole: ClassroomRole; close: () => void }) {
  const { t } = useI18n();
  const [role, setRole] = useState<ClassroomRole>(initialRole);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Map<string, Candidate>>(new Map());
  const [result, setResult] = useState<ActionState>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const h = setTimeout(async () => {
      try {
        const rows = await searchCandidatesAction(classroomId, role, q);
        if (!cancelled) setResults(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(h);
    };
  }, [classroomId, role, q]);

  const toggle = (c: Candidate) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(c.id)) next.delete(c.id);
      else next.set(c.id, c);
      return next;
    });
  const allVisibleSelected = results.length > 0 && results.every((r) => selected.has(r.id));

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRole(r);
              setSelected(new Map());
              setResult(null);
            }}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition",
              role === r ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-400",
            )}
          >
            {t(`admin.members.as.${r}`)}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">{t(`admin.members.eligible.${role}`)}</p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.members.searchPh")} className="pl-9" autoFocus aria-label={t("common.search")} />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={allVisibleSelected}
              disabled={!results.length}
              onChange={(e) =>
                setSelected((prev) => {
                  const next = new Map(prev);
                  for (const r of results) {
                    if (e.target.checked) next.set(r.id, r);
                    else next.delete(r.id);
                  }
                  return next;
                })
              }
            />
            {t("admin.members.selectVisible")}
          </label>
          <span>{t("admin.members.selectedN", { n: selected.size })}</span>
        </div>
        <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {!loading && results.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-500">{t("admin.members.noCandidates")}</li>}
          {results.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c)}
                />
                <Avatar user={c} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{fullName(c)}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {c.email}
                    {(c.title || c.track) && ` · ${c.title ?? c.track}`}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {result?.error && <p className="text-sm font-medium text-red-600">{t(result.error)}</p>}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button variant="ghost" onClick={close}>
          {t("common.cancel")}
        </Button>
        <Button
          disabled={!selected.size || pending}
          onClick={() =>
            start(async () => {
              const res = await addMembersAction(classroomId, role, [...selected.keys()]);
              setResult(res);
              if (res?.ok) close();
            })
          }
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("admin.members.addN", { n: selected.size })}
        </Button>
      </div>
    </div>
  );
}
