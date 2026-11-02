import { FileText, FileImage, FileArchive, FileVideo, File as FileIcon, Link2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";

type F = { id: string; originalName: string; mimeType: string; size: number };

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (/zip|rar|7z|tar|gzip/.test(mime)) return FileArchive;
  if (/pdf|text|word|document|sheet|presentation/.test(mime)) return FileText;
  return FileIcon;
}

export function Attachments({ files = [], links = [], renderExtra }: { files?: F[]; links?: string[]; renderExtra?: (f: F) => React.ReactNode }) {
  if (!files.length && !links.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {files.map((f) => {
        const Icon = iconFor(f.mimeType);
        return (
          <div key={f.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950">
              <Icon className="h-5 w-5" />
            </span>
            <a href={`/api/files/${f.id}`} target="_blank" className="min-w-0 flex-1 hover:underline">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{f.originalName}</p>
              <p className="text-xs text-slate-500">{formatBytes(f.size)}</p>
            </a>
            {renderExtra?.(f)}
          </div>
        );
      })}
      {links.map((l) => (
        <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950">
            <Link2 className="h-5 w-5" />
          </span>
          <span className="truncate text-sm text-brand-700 dark:text-brand-400">{l.replace(/^https?:\/\//, "")}</span>
        </a>
      ))}
    </div>
  );
}
