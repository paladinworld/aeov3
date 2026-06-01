---
name: netic-design
description: Use this skill to generate well-branded interfaces and assets for Netic — the AI voice & text agent for HVAC / plumbing / electrical home services. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping or production. Use when designing or writing copy for the Netic Onboarding Admin or Customer Review surfaces.
user-invocable: true
---

# Netic Design System — skill entry point

Netic is a voice & text AI agent for home services. Operators (HVAC, plumbing, electrical) plug it into their ServiceTitan tenant; it answers calls, qualifies jobs, and books appointments. The UI surfaces covered by this system are:

1. **Onboarding Admin** — Netic staff and dispatch admins configure tenants. Dense, data-first tables.
2. **Customer Review Wizard** — Operators review the configuration the admin set up for them. Guided, fewer knobs.
3. **Hub** — live-call dashboard / flagged / analytics. Tokens captured here; screens not recreated.

## Start here

1. Read `README.md` (in this folder). It contains the full content, visual, and iconography sections. Do not skip.
2. Load `colors_and_type.css` as your base stylesheet. It defines every color, spacing, radius, shadow, and type token as CSS custom properties and as utility classes (`.t-h1`, `.t-body`, `.t-overline`, etc.).
3. Reference the UI kits in `ui_kits/` for real, working component layouts:
   - `ui_kits/admin/Job Mapping Editor.html` — the canonical dense-table pattern with sidebar nav, summary strip, bulk-edit bar, confidence badges, and column tooltips.
   - `ui_kits/review/Customer Review Wizard.html` — the step-pill wizard, attention banner, and review-mode table.
4. Use `assets/netic-wordmark-*.svg` and `assets/netic-n-mark.svg` as your logo. Never redraw.

## Three rules that come up every time

1. **Sentence case, everywhere.** Including buttons, table headers, menu items. The only exceptions are the wordmark "Netic", product nouns (ServiceTitan), and the trade badges (`HVAC`, `PLUMBING`, `ELECTRICAL` in `10px / 500 / uppercase / 0.08em`).
2. **Outcome over mechanism.** Never ship a flag name. Rewrite `noCancel`, `isSchedulerEnabled`, `matchStatus: no_match` into plain English the column header reveals, and put the full "When ON … When OFF …" explanation in the tooltip — not the header.
3. **Borders do the work.** Cards are flat 1px-bordered rectangles with 8px radius and 24px padding. Shadow is reserved for floating chrome only: bulk-edit bar, dropdowns, modals. No gradients in-product. No emoji. No backdrop-blur.

## Icons

Lucide only, via `lucide-react` in code or the CDN in HTML. `strokeWidth={2}` default, `3` only for the checkbox check. Sizes: 14 / 16 / 20 / 64 px for specific roles — see README. Icons always inherit `currentColor`.

## Substitutions flagged

- **Slussen** (marketing display face from Figma) is substituted with **Inter** on the web. If the user provides WOFF2 files, update `--font-display` in `colors_and_type.css`.
- The **Blackbird repo** is referenced in the source brief but not accessible to this GitHub App install. The brand green (`#137A4A`) was lifted from the onboarding app's Tailwind tokens and matches Figma's dominant green.
- The **Hub** product is not recreated here. Ask the user which 1–3 screens they want lifted if Hub work is required.

## When to ask

- If the user wants a surface outside the two shipped UI kits (Hub, chat transcript, call logs, analytics) — ask what data lives there before designing, since these screens are only present in Figma pseudocode, not in the onboarding codebase.
- If copy appears in any form, read the **CONTENT FUNDAMENTALS** section of README.md and match the voice. Netic is "the thing that picks up the phone," not a platform.
