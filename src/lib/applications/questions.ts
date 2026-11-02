// application form questions, shared by the builder (client) and the server.
// stored as json on ApplicationForm.questions, answers as { [questionId]: string | string[] }
import { z } from "zod";

export const QUESTION_TYPES = [
  "short",
  "long",
  "single",
  "multi",
  "dropdown",
  "scale",
  "number",
  "phone",
  "url",
  "date",
  "section",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const CHOICE_TYPES: QuestionType[] = ["single", "multi", "dropdown"];

// answers to these questions fill in the student profile after an accepted applicant registers,
// and first/last name are used to show the applicant in lists
export const PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "birthDate",
  "university",
  "faculty",
  "courseYear",
  "github",
  "linkedin",
  "portfolio",
  "preferredTrack",
  "priorExperience",
  "motivation",
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

export const MAX_QUESTIONS = 80;
export const MAX_OPTIONS = 40;
export const OTHER_PREFIX = "__other:";

export const questionSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{4,16}$/),
  type: z.enum(QUESTION_TYPES),
  label: z.string().trim().max(300), // empty labels are reported by checkQuestions
  help: z.string().trim().max(1000).optional().default(""),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().max(200)).max(MAX_OPTIONS).optional().default([]),
  other: z.boolean().optional().default(false),
  min: z.number().int().optional(),
  max: z.number().int().optional(),
  minLabel: z.string().max(60).optional().default(""),
  maxLabel: z.string().max(60).optional().default(""),
  field: z.enum(PROFILE_FIELDS).nullable().optional().default(null),
});
export type Question = z.infer<typeof questionSchema>;

export const questionsSchema = z.array(questionSchema).max(MAX_QUESTIONS);

export function newQuestionId() {
  return Math.random().toString(36).slice(2, 10).padEnd(6, "0");
}

export function blankQuestion(type: QuestionType = "short"): Question {
  return {
    id: newQuestionId(),
    type,
    label: "",
    help: "",
    required: type !== "section",
    options: CHOICE_TYPES.includes(type) ? ["", ""] : [],
    other: false,
    min: type === "scale" ? 1 : undefined,
    max: type === "scale" ? 5 : undefined,
    minLabel: "",
    maxLabel: "",
    field: null,
  };
}

// lenient read of whatever is in the db
export function parseQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw)) return [];
  const out: Question[] = [];
  for (const q of raw) {
    const r = questionSchema.safeParse(q);
    if (r.success) out.push(r.data);
  }
  return out;
}

// builder output -> problems keyed by question id, empty when fine
export function checkQuestions(qs: Question[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const ids = new Set<string>();
  const fields = new Set<string>();
  for (const q of qs) {
    if (ids.has(q.id)) errors[q.id] = "applications.builder.errors.duplicate";
    ids.add(q.id);
    if (!q.label.trim()) errors[q.id] = "applications.builder.errors.noLabel";
    else if (CHOICE_TYPES.includes(q.type) && q.options.filter((o) => o.trim()).length < 1) errors[q.id] = "applications.builder.errors.noOptions";
    else if (CHOICE_TYPES.includes(q.type) && new Set(q.options).size !== q.options.length) errors[q.id] = "applications.builder.errors.sameOptions";
    else if (q.type === "scale" && (q.min === undefined || q.max === undefined || q.max <= q.min || q.max - q.min > 10 || q.min < 0))
      errors[q.id] = "applications.builder.errors.scale";
    else if (q.field && fields.has(q.field)) errors[q.id] = "applications.builder.errors.fieldTwice";
    if (q.field) fields.add(q.field);
  }
  if (!qs.some((q) => q.type !== "section")) errors._ = "applications.builder.errors.empty";
  return errors;
}

export type Answer = string | string[];
export type Answers = Record<string, Answer>;

const LIMITS: Partial<Record<QuestionType, number>> = { short: 300, long: 5000, url: 500, phone: 40, number: 30, date: 10 };

// raw form values -> clean answers + per question error keys
export function validateAnswers(qs: Question[], raw: Record<string, Answer | undefined>) {
  const answers: Answers = {};
  const errors: Record<string, string> = {};
  for (const q of qs) {
    if (q.type === "section") continue;
    const v = raw[q.id];
    if (q.type === "multi") {
      const list = (Array.isArray(v) ? v : v ? [v] : []).map((s) => s.trim()).filter(Boolean);
      const clean: string[] = [];
      for (const item of list) {
        if (q.options.includes(item)) clean.push(item);
        else if (q.other && item.startsWith(OTHER_PREFIX) && item.length > OTHER_PREFIX.length) clean.push(item.slice(0, 300));
      }
      if (clean.length) answers[q.id] = [...new Set(clean)];
      else if (q.required) errors[q.id] = "applications.apply.errors.required";
      continue;
    }
    const s = (Array.isArray(v) ? v[0] ?? "" : v ?? "").trim();
    if (!s) {
      if (q.required) errors[q.id] = "applications.apply.errors.required";
      continue;
    }
    const limit = LIMITS[q.type];
    if (limit && s.length > limit) {
      errors[q.id] = "applications.apply.errors.tooLong";
      continue;
    }
    switch (q.type) {
      case "single":
      case "dropdown":
        if (!q.options.includes(s) && !(q.type === "single" && q.other && s.startsWith(OTHER_PREFIX) && s.length > OTHER_PREFIX.length)) {
          errors[q.id] = "applications.apply.errors.choose";
          continue;
        }
        break;
      case "scale": {
        const n = Number(s);
        if (!Number.isInteger(n) || n < (q.min ?? 1) || n > (q.max ?? 5)) {
          errors[q.id] = "applications.apply.errors.choose";
          continue;
        }
        break;
      }
      case "number": {
        const n = Number(s.replace(",", "."));
        if (!Number.isFinite(n) || (q.min !== undefined && n < q.min) || (q.max !== undefined && n > q.max)) {
          errors[q.id] = "applications.apply.errors.number";
          continue;
        }
        break;
      }
      case "phone":
        if (!/^\+?[\d\s()-]{7,20}$/.test(s)) {
          errors[q.id] = "applications.apply.errors.phone";
          continue;
        }
        break;
      case "url":
        if (!/^https?:\/\/\S+\.\S+/i.test(s)) {
          errors[q.id] = "applications.apply.errors.url";
          continue;
        }
        break;
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(s).getTime())) {
          errors[q.id] = "applications.apply.errors.date";
          continue;
        }
        break;
    }
    answers[q.id] = s;
  }
  return { answers, errors };
}

export function isOther(v: string) {
  return v.startsWith(OTHER_PREFIX);
}

// human readable answer
export function answerText(a: Answer | undefined, otherLabel = "Other"): string {
  if (a === undefined) return "";
  const one = (s: string) => (isOther(s) ? `${otherLabel}: ${s.slice(OTHER_PREFIX.length)}` : s);
  return Array.isArray(a) ? a.map(one).join(", ") : one(a);
}

export function mappedValue(qs: Question[], answers: Answers, field: ProfileField): string {
  const q = qs.find((x) => x.field === field);
  if (!q) return "";
  return answerText(answers[q.id]).trim();
}

export function applicantName(qs: Question[], answers: Answers) {
  return [mappedValue(qs, answers, "firstName"), mappedValue(qs, answers, "lastName")].filter(Boolean).join(" ").slice(0, 160);
}

export function isFormLive(form: { isOpen: boolean; closesAt: Date | null }, now = new Date()) {
  return form.isOpen && (!form.closesAt || form.closesAt > now);
}

export const STATUSES = ["SUBMITTED", "SHORTLISTED", "WAITLISTED", "ACCEPTED", "REJECTED"] as const;
export const STATUS_TONES = {
  SUBMITTED: "gray",
  SHORTLISTED: "blue",
  WAITLISTED: "yellow",
  ACCEPTED: "green",
  REJECTED: "red",
} as const;
