import "server-only";
import { mkdir, readFile, unlink, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { env } from "./env";

const BLOCKED_EXT = new Set([".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".ps1", ".vbs", ".jar", ".sh"]);

export type FileTarget =
  | { assignmentId: string }
  | { submissionId: string }
  | { announcementId: string }
  | Record<string, never>;

export class UploadError extends Error {
  constructor(public code: "tooLarge" | "blockedType" | "empty") {
    super(code);
  }
}

function root() {
  return path.resolve(env.uploadDir);
}

function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 200) || "file";
}

export async function saveUploads(files: File[], uploaderId: string, target: FileTarget = {}) {
  const real = files.filter((f) => f && typeof f === "object" && f.size > 0);
  for (const f of real) {
    if (f.size > env.maxUploadBytes) throw new UploadError("tooLarge");
    if (BLOCKED_EXT.has(path.extname(f.name).toLowerCase())) throw new UploadError("blockedType");
  }
  const created = [];
  for (const f of real) {
    const now = new Date();
    const dir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const key = `${dir}/${randomBytes(16).toString("hex")}${path.extname(f.name).toLowerCase()}`;
    const abs = path.join(root(), key);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, Buffer.from(await f.arrayBuffer()));
    created.push(
      await db.fileObject.create({
        data: {
          storageKey: key,
          originalName: safeName(f.name),
          mimeType: f.type || "application/octet-stream",
          size: f.size,
          uploaderId,
          ...target,
        },
      }),
    );
  }
  return created;
}

export async function readStoredFile(storageKey: string) {
  const abs = path.join(root(), storageKey);
  if (!abs.startsWith(root())) throw new Error("bad key");
  return readFile(abs);
}

export async function storedFileExists(storageKey: string) {
  try {
    await stat(path.join(root(), storageKey));
    return true;
  } catch {
    return false;
  }
}

export async function deleteFileObject(id: string) {
  const f = await db.fileObject.delete({ where: { id } });
  await unlink(path.join(root(), f.storageKey)).catch(() => {});
}

export async function deleteBlobs(where: { assignmentId?: string; submissionId?: string; announcementId?: string }) {
  const files = await db.fileObject.findMany({ where, select: { storageKey: true } });
  await Promise.all(files.map((f) => unlink(path.join(root(), f.storageKey)).catch(() => {})));
}

export function filesFrom(fd: FormData, field = "files"): File[] {
  return fd.getAll(field).filter((v): v is File => typeof v === "object" && v !== null && "size" in v);
}
