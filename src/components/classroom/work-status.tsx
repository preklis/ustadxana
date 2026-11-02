import type { AssignmentType, SubmissionStatus } from "@prisma/client";
import { BookOpen, ClipboardList, MessageCircleQuestion } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type WorkState = "ASSIGNED" | "MISSING" | "TURNED_IN" | "TURNED_IN_LATE" | "RETURNED" | "GRADED";

type Sub = { status: SubmissionStatus; isLate: boolean; grade: number | null } | null | undefined;

export function workState(dueAt: Date | null, sub: Sub, now = new Date()): WorkState {
  if (!sub || sub.status === "DRAFT") return dueAt && dueAt < now ? "MISSING" : "ASSIGNED";
  if (sub.status === "SUBMITTED") return sub.isLate ? "TURNED_IN_LATE" : "TURNED_IN";
  return sub.grade != null ? "GRADED" : "RETURNED";
}

export const WORK_TONE = {
  ASSIGNED: "blue",
  MISSING: "red",
  TURNED_IN: "green",
  TURNED_IN_LATE: "orange",
  RETURNED: "purple",
  GRADED: "purple",
} as const;

type T = (key: string, vars?: Record<string, string | number>) => string;

export function workLabel(t: T, state: WorkState, grade?: number | null, maxPoints?: number | null) {
  if (state === "GRADED" && grade != null) {
    return maxPoints != null ? t("classwork.status.gradedOf", { grade, max: maxPoints }) : t("classwork.status.gradedPts", { grade });
  }
  return t(`classwork.status.${state}`);
}

export function WorkBadge({ state, label, className }: { state: WorkState; label: string; className?: string }) {
  return (
    <Badge tone={WORK_TONE[state]} className={className}>
      {label}
    </Badge>
  );
}

const TYPE_ICON = { ASSIGNMENT: ClipboardList, MATERIAL: BookOpen, QUESTION: MessageCircleQuestion } as const;
const TYPE_COLOR = {
  ASSIGNMENT: "bg-brand-600 text-brand-fg",
  MATERIAL: "bg-slate-500 text-white dark:bg-slate-600",
  QUESTION: "bg-amber-500 text-white",
} as const;

export function TypeIcon({ type, muted, size = "md" }: { type: AssignmentType; muted?: boolean; size?: "sm" | "md" }) {
  const Icon = TYPE_ICON[type];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        muted ? "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400" : TYPE_COLOR[type],
      )}
    >
      <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
    </span>
  );
}
