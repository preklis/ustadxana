import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/i18n/server";
import { Card, CardBody } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";

export default async function PendingPage() {
  const user = await requireUser();
  if (user.status === "ACTIVE") redirect("/dashboard");
  if (user.status === "PROFILE_INCOMPLETE") redirect("/onboarding");
  const { t } = await getI18n();
  const rejected = user.status === "REJECTED";
  return (
    <Card>
      <CardBody className="py-14 text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${rejected ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
          {rejected ? <XCircle className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
        </div>
        <h1 className="mt-6 text-2xl font-bold">{t(rejected ? "auth.pending.rejectedTitle" : "auth.pending.title")}</h1>
        <p className="mx-auto mt-2 max-w-md text-slate-500">{t(rejected ? "auth.pending.rejectedText" : "auth.pending.text")}</p>
        {rejected && user.rejectionReason && (
          <p className="mx-auto mt-4 max-w-md rounded-lg bg-slate-50 p-4 text-left text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {user.rejectionReason}
          </p>
        )}
        <div className="mt-8">
          <Link href="/onboarding?edit=1" className={buttonClass("outline")}>
            {t("auth.pending.editProfile")}
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
