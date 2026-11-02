import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarClock, Inbox } from "lucide-react";
import { getLiveForms } from "@/lib/applications/server";
import { getI18n } from "@/i18n/server";
import { formatDate } from "@/lib/utils";
import { Card, EmptyState } from "@/components/ui/primitives";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("applications.apply.listTitle") };
}

export default async function ApplyIndexPage() {
  const [{ t, locale }, forms] = await Promise.all([getI18n(), getLiveForms()]);
  if (forms.length === 1) redirect(`/apply/${forms[0].slug}`);

  return (
    <div className="animate-fade-up">
      <h1 className="bc-page-title text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{t("applications.apply.listTitle")}</h1>
      <div className="mt-8 space-y-3">
        {forms.length === 0 ? (
          <EmptyState icon={<Inbox className="h-10 w-10" />} title={t("applications.apply.listEmpty")} />
        ) : (
          forms.map((f) => (
            <Link key={f.id} href={`/apply/${f.slug}`} className="group block">
              <Card className="flex items-center justify-between gap-4 p-5 transition group-hover:border-brand-300 dark:group-hover:border-brand-800">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{t(`applications.kinds.${f.kind}`)}</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{f.title}</h2>
                  {f.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{f.description}</p>}
                  {f.closesAt && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {t("applications.apply.until", { date: formatDate(f.closesAt, locale) })}
                    </p>
                  )}
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
