// error/message/fieldErrors are i18n keys, translated on the client
export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: Record<string, string>;
} | null;

export const ok = (message?: string, data?: Record<string, string>): ActionState => ({ ok: true, message, data });
export const fail = (error = "common.genericError", fieldErrors?: Record<string, string>): ActionState => ({
  ok: false,
  error,
  fieldErrors,
});

export function zodFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "_");
    if (!out[k]) out[k] = i.message.includes(".") ? i.message : "common.required";
  }
  return out;
}

export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(fd: FormData, key: string) {
  const v = str(fd, key);
  return v === "" ? null : v;
}
