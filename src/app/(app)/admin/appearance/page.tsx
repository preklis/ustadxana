import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { MESSAGES } from "@/i18n/messages";
import { normalizeTheme } from "@/lib/theme/config";
import { DEFAULT_PACK_SLUG, syncBuiltinPacks } from "@/lib/theme/builtin-packs";
import { getThemeRecord } from "@/lib/theme/server";
import { PageHeader, Tabs } from "@/components/ui/primitives";
import { AppearanceEditor, type TextEntry } from "./appearance-editor";
import { ThemeGallery, type PackCard } from "./theme-gallery";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("admin.appearance.title") };
}

function flatten(obj: unknown, prefix = "", out: Record<string, string> = {}) {
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (typeof obj === "string") out[prefix] = obj;
  return out;
}

export default async function AppearancePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePermission("MANAGE_APPEARANCE");
  await syncBuiltinPacks(db);
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "customize" ? "customize" : "themes";
  const [{ t, locale }, record] = await Promise.all([getI18n(), getThemeRecord()]);

  const tabs = (
    <Tabs
      active={tab}
      tabs={[
        { key: "themes", label: t("admin.appearance.tabs.themes"), href: "/admin/appearance" },
        { key: "customize", label: t("admin.appearance.tabs.customize", { name: record.pack.name }), href: "/admin/appearance?tab=customize" },
      ]}
    />
  );

  if (tab === "themes") {
    const packs = await db.themePack.findMany({ orderBy: [{ builtIn: "desc" }, { createdAt: "asc" }] });
    const cards: PackCard[] = packs.map((p) => {
      const d = normalizeTheme(p.custom ?? p.defaults);
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        version: p.version,
        author: p.author,
        description: p.description,
        builtIn: p.builtIn,
        customized: p.custom !== null,
        active: p.id === record.pack.id,
        screenshot: p.screenshot ? `/api/theme-assets/${p.id}/${p.screenshot}?v=${p.updatedAt.getTime()}` : null,
        updatedAt: formatDate(p.updatedAt, locale),
        preview: { accent: d.colors.accent, neutral: d.colors.neutral, mode: d.mode.default, radius: d.radius, login: d.layout.login, terminal: d.parts.loginTerminal && d.parts.loginHero },
      };
    });
    const starter = packs.find((p) => p.slug === DEFAULT_PACK_SLUG);
    return (
      <div>
        <PageHeader title={t("admin.appearance.title")} description={t("admin.appearance.packs.description")} />
        {tabs}
        <ThemeGallery packs={cards} starterUrl={starter ? `/api/themes/${starter.id}/download` : null} />
      </div>
    );
  }

  const pack = record.pack.id ? await db.themePack.findUnique({ where: { id: record.pack.id } }) : null;
  if (!pack) return null;

  // every ui text with its default, for the text overrides section
  const az = flatten(MESSAGES.az);
  const en = flatten(MESSAGES.en);
  const texts: TextEntry[] = Object.keys(en)
    .filter((k) => !k.startsWith("admin.appearance."))
    .map((k) => ({ key: k, az: az[k] ?? "", en: en[k] }));

  return (
    <div>
      <PageHeader title={t("admin.appearance.title")} description={t("admin.appearance.description")} />
      {tabs}
      <AppearanceEditor
        key={pack.id}
        packId={pack.id}
        packName={pack.name}
        packCss={pack.css}
        customized={pack.custom !== null}
        initial={normalizeTheme(pack.custom ?? pack.defaults)}
        packDefaults={normalizeTheme(pack.defaults)}
        texts={texts}
      />
    </div>
  );
}
