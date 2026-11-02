import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { getI18n } from "@/i18n/server";
import { Badge, Card } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";

// shown to anyone who reviews applications while a form is open (always for applicant checkers)
export async function ApplicationsWidget({ user }: { user: SessionUser }) {
  const { t } = await getI18n();
  const forms = await db.applicationForm.findMany({
    where: { isOpen: true },
    orderBy: { openedAt: "desc" },
    select: { id: true, title: true, _count: { select: { applications: true } } },
  });
  const checker = user.role === "APPLICANT_CHECKER";
  if (!forms.length && !checker) return null;
  const todo = await Promise.all(
    forms.map((f) => db.application.count({ where: { formId: f.id, status: "SUBMITTED", reviews: { none: { reviewerId: user.id } } } })),
  );
  const total = todo.reduce((s, n) => s + n, 0);

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
            <Inbox className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">{t("applications.widget.title")}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {forms.length === 0 ? t("applications.forms.emptyChecker") : total ? t("applications.widget.text", { n: total }) : t("applications.widget.allDone")}
            </p>
            {forms.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {forms.map((f, i) => (
                  <Link key={f.id} href={`/admin/applications/${f.id}${todo[i] ? "?sort=unscored" : ""}`}>
                    <Badge tone={todo[i] ? "yellow" : "gray"} className="hover:opacity-80">
                      {f.title} · {todo[i]}/{f._count.applications}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        <LinkButton href={forms.length === 1 ? `/admin/applications/${forms[0].id}?sort=unscored` : "/admin/applications"} size="sm" className="shrink-0">
          {t("applications.widget.open")}
          <ArrowRight className="h-4 w-4" />
        </LinkButton>
      </div>
    </Card>
  );
}
