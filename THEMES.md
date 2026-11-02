# Theme packs

The look of the platform comes from theme packs, a bit like WordPress themes. Admins with the
"Manage appearance" permission install them under **Administration → Appearance → Themes**, try
them with *Live preview* (only they see it), and *Activate* one for everyone. Open tabs pick up the
change within ~30 seconds, no reload needed.

Every pack keeps its own customizations (the **Customize** tab), so switching back and forth
doesn't lose anything. *Download* gives you the pack as a zip, including your customizations,
which is also the easiest way to start a new theme.

Three packs ship with the app: **Ustadxana** (default), **Clean** (no terminal, light) and
**Campus** (centered sign-in card). They're defined in `src/lib/theme/builtin-packs.ts`.

## Zip layout

```
my-theme.zip
├── theme.json          required
├── style.css           optional, any css
├── screenshot.png      optional, shown in the theme list (3:2, e.g. 1200x800). .jpg/.webp work too
├── slots/
│   └── loginHero.html  optional html blocks, file name = slot name
└── assets/             optional images and fonts (png jpg gif webp avif svg ico woff woff2 ttf otf)
    └── hero.jpg
```

The files can also sit inside one top folder (what "compress folder" produces). Limits: 10 MB
zipped, 40 MB unzipped, 300 files. Uploading a pack with the same `slug` again updates it and
keeps the customizations.

See `themes/example-no-terminal/` for a complete example.

## theme.json

```jsonc
{
  "name": "Night Shift",            // required
  "slug": "night-shift",            // optional, made from the name otherwise
  "version": "1.2.0",
  "author": "Your team",
  "description": "Short text shown in the theme list",
  "settings": {                     // everything is optional, missing values use the defaults
    "identity": { "siteName": "Ustadxana", "accentWord": "", "tagline": "Təlim platforması",
                  "orgName": "Your organization", "hashtag": "#ustadxana",
                  "logoText": ">_", "logo": null, "uppercase": true },
    "colors": { "accent": "#0d9488", "neutral": "zinc" },    // neutral: navy slate zinc neutral stone or "#rrggbb"
    "mode": { "default": "dark", "allowToggle": true },      // dark | light | system
    "font": "geist",                                         // geist | noto | system
    "radius": 1,                                             // 0 | 0.5 | 1 | 1.5
    "background": { "pattern": "dots", "glow": true },       // dots | grid | none
    "login": { "command": "./ustadxana --start", "versionPill": "v1.0", "terminalPath": "~/ustadxana" },
    "layout": { "login": "split", "content": "normal" },     // split | split-reverse | centered ; normal | wide | full
    "parts": {                                               // false hides that piece of the ui
      "loginHero": true, "loginTerminal": true, "loginCommand": true, "loginVersion": true,
      "loginOrg": true, "loginSubtitle": true, "loginFooter": true, "sidebarTagline": true,
      "themeToggle": true, "localeSwitcher": true, "pageAnimations": true, "applyBanner": true
    },
    "slots": { "appBanner": "<div class=\"my-banner\">Hello</div>" },
    "messages": {                                            // override any ui text by its key
      "az": { "auth.login.title": "Xoş gəldin" },
      "en": { "auth.login.title": "Welcome" }
    },
    "customCss": ""                                          // extra css, same rules as style.css
  }
}
```

Text keys are the ones in `src/i18n/messages/{az,en}/*.ts`, written as `<file>.<path>`, e.g.
`auth.login.subtitle`. The Texts panel in Customize lets you search them.

## CSS

`style.css` is loaded on every page after the app's own styles. Useful things:

- **Colors** are css variables holding rgb channels: `rgb(var(--brand-500))`,
  `rgb(var(--slate-900) / 0.5)`. Steps 50–950 for `--brand-*` (accent) and `--slate-*` (base),
  plus `--brand-fg` (text on accent). Change them in `settings.colors` instead of overriding.
- **Dark mode**: `.dark .bc-card { ... }`.
- **The active pack**: `<html data-theme="your-slug">`. Also `data-pattern`, `data-glow`,
  `data-content`, `data-motion` on `<html>`.
- **Assets**: `url("assets/hero.jpg")`, rewritten to the pack's public url.

Hook classes:

| Area | Classes |
| --- | --- |
| Sign-in | `.bc-login` (`data-layout`), `.bc-login-hero`, `.bc-hero-bg`, `.bc-login-top`, `.bc-login-org`, `.bc-login-version`, `.bc-login-terminal`, `.bc-login-headline`, `.bc-login-command`, `.bc-login-title`, `.bc-accent`, `.bc-login-subtitle`, `.bc-login-footer`, `.bc-login-main`, `.bc-login-card` |
| App shell | `.bc-app`, `.bc-topbar` (mobile), `.bc-sidebar`, `.bc-sidebar-tagline`, `.bc-sidebar-footer`, `.bc-nav`, `.bc-nav-title`, `.bc-nav-item`, `.bc-nav-item-active`, `.bc-main` |
| Pages | `.bc-page-header`, `.bc-page-title`, `.bc-page-description`, `.bc-dashboard` |
| Components | `.bc-card`, `.bc-card-header`, `.bc-btn` + `.bc-btn-primary/secondary/outline/ghost/danger`, `.bc-input`, `.bc-badge` + `.bc-badge-<tone>` |
| Applications | `.bc-apply-banner` (top strip while a form is open), `.bc-apply`, `.bc-apply-header`, `.bc-apply-main`, `.bc-question` (`data-type`) |
| HTML slots | `.bc-slot`, `.bc-slot-<name>` |

Not allowed (the upload is rejected): `@import` except Google Fonts, `url()` to other sites
(only `assets/...`, `data:` images/fonts and `fonts.gstatic.com`), `expression()`,
`javascript:`, `-moz-binding`, `</style>`.

## HTML slots

`loginHero`, `loginAboveForm`, `loginBelowForm`, `appBanner`, `dashboardTop`, `sidebarFooter`,
`appFooter`. Put them in `slots/<name>.html` or `settings.slots`. They're sanitized: no
`<script>`, no `on*=` handlers, no `javascript:` links, no inline styles with `url()`. Classes,
images (`assets/...` or https), links and simple inline svg are fine.
