# Netic Design System

_AI dispatcher for home services — voice & text agents that answer the phone, qualify the job, check availability, and book it straight into ServiceTitan._

Netic is live in 30+ HVAC, plumbing, and electrical companies. Users are home services operators — owners, dispatchers, CSR leads. UI is dense and data-first for admins; simpler and more guided for customer-facing review flows.

> "We are not a platform. We are the thing that picks up the phone."

---

## Products covered by this system

| Surface | Audience | Density | Where to see it |
|---|---|---|---|
| **Onboarding Admin** | Netic staff + dispatch admins | Power-user, dense tables | `ui_kits/admin/` |
| **Customer Review Wizard** | Home-services operators reviewing their config | Guided, fewer knobs | `ui_kits/review/` |
| **Hub (Live calls / Flagged / Analytics)** | Dispatchers + ops | Dense, real-time | Figma only (`WIP-Comprehensive-Hub-designs`, `Pre-launch-Nen-creative`) — not recreated here |

The two UI kits recreated in this repo (`admin`, `review`) are faithful ports of the `netic-onboarding` Next.js app. The Hub is the larger product represented in the Figma file; we've captured its tokens and iconography here without recreating its screens.

---

## Sources (attach these when re-running the skill)

- **Codebase** — `danielcruz-netic/netic-onboarding` (private repo). Imported under `reference/` here. The **design-token source of truth** is `reference/app/globals.css`. Components in `reference/components/job-mapping/` are the canonical patterns (boolean toggle, checkbox w/ indeterminate, portal-ish tooltip, confidence badges, bulk-edit bar).
- **Figma** — `📥 Convert_ Hub.fig` (17 pages, 1,002 top-level frames). Top colors, fonts, component usage captured in the design-token work. The file is mostly dedicated to the Hub product (WIP + Pre-launch); the Onboarding app is absent from Figma and was read directly from code.
- **Blackbird repo** — referenced in the notes as the origin of "Netic green" and the target of the JSON export, but **not accessible** from this GitHub app install. Install URL: https://github.com/apps/claude-design-import/installations/new. The green value here (`hsl(147 73% 27%)` ≈ `#137A4A`) comes from the onboarding app's Tailwind tokens and is confirmed by the Figma's dominant brand color (`rgb(19,122,74)`, 7,644 occurrences).

---

## Index — files at the root of this system

| File | What it holds |
|---|---|
| `README.md` | This file. Start here. |
| `SKILL.md` | Agent Skills entry point; forward-compatible with Claude Code. |
| `colors_and_type.css` | All color + type + spacing + radius + shadow tokens as CSS custom properties. |
| `assets/` | Logos (wordmark green/cream/white, N-mark), brand imagery. |
| `preview/` | Small HTML specimen cards that populate the Design System tab. |
| `ui_kits/admin/` | Admin dashboard + tenant / Job Mapping Editor click-thru. |
| `ui_kits/review/` | Customer 5-step review wizard click-thru. |
| `reference/` | Imported source from `netic-onboarding`. Consult when stuck. |

---

## CONTENT FUNDAMENTALS — how Netic writes copy

**Voice.** Confident, operator-friendly, plain English. We are **not** a "platform"; we are the thing that picks up the phone. No jargon. No em-dash verbosity. If a dispatcher wouldn't say it out loud on a ride-along, we don't put it in the UI.

**Casing.** Sentence case for everything — buttons, section titles, table headers, menu items. _Allowed_ title-case exceptions: the wordmark "Netic", product nouns like "ServiceTitan", and proper trade labels in badges (`HVAC`, `PLUMBING`, `ELECTRICAL` — often rendered UPPERCASE with `0.08em` letter-spacing).

**Person.**
- Admin surfaces speak _about_ the operator: _"Create a login for the customer to review their configuration."_
- Customer-facing surfaces speak _to_ the operator, using **you / your**: _"These are the job types Netic's AI agent will handle for your customers."_
- Never "we" in system copy unless it's a brand moment (landing pages, empty-state reassurance).

**Outcome over mechanism.** We never ship flag names. Rewrite every internal boolean as a plain-English outcome.

| Don't | Do |
|---|---|
| `noCancel: false` | **Allow Cancel** |
| `isSchedulerEnabled` | **Scheduler** (column) / "Customers can self-book this online" (tooltip) |
| `matchStatus: no_match` | **No Match** badge · _"No matching model tenant job type found"_ |
| "Unresolved entities" | **Items Needing Your Input** |

**Tooltips carry the weight.** Column headers are terse (`Bookable`, `Cancel`, `Reschedule`). The tooltip is where the real sentence lives: _"When ON, the Netic AI agent can schedule this job type for your customers."_ Always in the form _"When ON, … When OFF, …"_ when it's a boolean.

**Empty states and tips are a helpful colleague, not a legal disclaimer.**
> Tip: Click any toggle to change a setting. Changes save automatically. Click a display name or price to edit it.

**Numbers are literal.** "3 selected" — never "3 item(s)". Plural elegantly: _"1 item"_, _"2 items"_.

**No emoji. No punctuation flair.** The one mark that appears is `✎ Add X` (the pencil) to indicate an editable empty cell; and `✓` for a completed wizard step.

---

## VISUAL FOUNDATIONS

### Colors

Netic's palette is **warm cream and clean white, punctuated by deep Netic green and black-gray type.** The Figma metadata confirms this: black, white, and `rgb(19,122,74)` green are the three most-used colors by an order of magnitude.

- **Netic green** `hsl(147 73% 27%)` ≈ `#137A4A` — primary buttons, selected nav, active toggles, the wordmark
- **Deep green** `#0D5A2B` — hovered primary, pressed state, large marketing backgrounds
- **Ink green** `#173F33` — the cover-frame backdrop; reserved for full-bleed brand moments
- **Cream** `#FFFDF5` — the marketing / print cream (shows on the cover frame under the wordmark). Never on the app surface.
- **Surface** pure white `#FFFFFF`; page-muted `#F8F8F8`; sidebar `#FAFAFA`
- **Text** `#303030` body/heading · `#646464` captions · `#A1A1A1` placeholder
- **Borders** `#E3E5E7` default · `#D1D1D1` strong
- **Status** success (same hue as primary at 41% L) · warning amber `#E88A33` · destructive red `#C72828` · accent blue `#3778C2` (transfer / info)
- **Trade accents** (review surface only): HVAC blue, Plumbing cyan, Electrical amber — always a light bg + deep fg, never a saturated fill

### Typography

**Inter for everything.** Regular / Medium / Semibold / Bold. Sizes cluster tightly at 12/13/14/16 — this is not a "display" app. When larger type appears it's on marketing (Slussen, subbed for Inter on the web until the type files arrive).

- Page H1 `24px / 600`
- Section H3 `18–20px / 600`
- Body / table cell `14px / 400`
- Table header / helper / captions `12px / 500` (muted fg)
- Sublabel (ST-name under display name) `11px / 400` at 60% opacity
- Micro labels (trade badges, overline) `10px / 500 uppercase` at 0.08em tracking

### Spacing

A strict 4-px grid. The useful rungs are `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`. Toolbars use `12–16` gaps; table cells pad `12` horizontal, `8` vertical; cards pad `24`; modals pad `24–32`.

### Corner radii

- **6 px (md)** — buttons, inputs, filter chips, table containers
- **8 px (lg)** — cards, modals, section containers
- **4 px (sm)** — checkboxes, small badges
- **Full** — pill badges, trade tabs, wizard step pills, toggle tracks

### Borders, shadows, elevation

- **Borders do most of the work.** `1px solid var(--border)` on cards, tables, inputs. The palette barely uses shadow.
- **Shadow** is reserved for floating chrome: the bulk-edit bar (`shadow-lg`), dropdown / tooltip popouts (`shadow-md`), modal (`shadow-overlay`). Cards are **flat** in-page.
- No inner shadows. No neumorphism. No glass / frosted blur.

### Backgrounds

- **Solid surfaces only** in-app. No gradients, no patterns, no textures in product.
- The marketing cover frame is the one exception: a solid **ink green** field with the cream wordmark centered.
- **Tinted washes** (`/5`, `/10`, `/30` opacity of a semantic color) are the go-to for row highlights (destructive row on `bg-destructive/5`; warning row on `bg-warning/5`; muted hover on `bg-muted/30`).

### Cards

Flat rectangles with `1px` border, `8 px` radius, `24 px` padding. If a card needs emphasis, it gets a **tinted background** (`bg-warning/5` + `border-warning/30`), **never** a drop shadow.

### Hover / press / focus

- **Hover** — background darkens by one step (`muted` → `muted-hover`, `primary` → `primary-hover`). Text links shift to `--primary`. Transition `colors 120–180ms`.
- **Press** — no transform; the hover shade holds. On boolean toggles the thumb slides `transform: translateX` in `180ms`.
- **Focus** — `outline: none; ring: 2px var(--ring) (= primary-hover); ring-offset: 2px`. Always visible; never suppressed.
- **Disabled** — opacity 40%, cursor not-allowed. No desaturation.

### Animation

- Sparse. Accordions open/close `200ms ease-out`. Color transitions `120–180ms`. Toggle thumb `180ms`. No bouncy springs. No auto-playing loops except the audio-waveform animations in the Hub (out of scope here).
- **Easing default** — `ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)` for anything longer than 200ms).

### Transparency / blur

- Opacity multipliers on semantic colors are fair game (`/5`, `/10`, `/20`, `/30`, `/50`). They're used for row tinting and "muted" badge fills.
- **Backdrop-blur is not used.** Modals sit on `bg-black/50` flat.

### Layout rules

- Admin: full-height split — fixed **`w-64` sidebar** (`bg-sidebar`, 1px right border) + scrollable main `p-8`.
- Review: centered column `max-w-5xl mx-auto` on a `bg-muted/30` page; a thin top app-bar with the Netic wordmark.
- Tables: `w-full` container with border + overflow-hidden; headers `bg-muted/50`; rows divided by 1px border-bottom (none on last row).
- The **bulk-edit bar** floats fixed `bottom-6 left-1/2 -translate-x-1/2 z-50` when any row is selected.

### Decks & marketing surfaces

A second palette lives in the marketing surfaces (rollout decks, sales diagrams) confirmed by `ARS Roll Out Plan.fig`. **Do not bring these into the product** — product greens are `--primary` and `--success` only.

- **Green tint scale** `--green-50` → `--green-900`. The pale-mint `--green-200` (`#C4DDD1`) is the canonical "highlight column" fill at 40–90% alpha; `--green-700` (`#0F5B2C`) is the "production / after" fill.
- **Comparison columns** are the recurring composition: a left column on neutrals (`#8A8A8A` / `#E2E2E2` / `#A4A4A4`) for the "before / test" state, and a right column on green tints for the "after / production" state. Dashed rounded-rectangle frames group the column.
- **Header type** Inter Bold 32–40 px with an italic Inter overline above (`Inter Italic 24–26`).
- **Stat labels** use `--font-mono-display` (DM Mono) at ~30 px.
- **Footer** every slide carries the N-mark bottom-left and `© NETIC.AI <year> ALL RIGHTS RESERVED` bottom-right.
- Photography is permitted in marketing only — never in product.

### Imagery

Netic doesn't use stock photography in-product. The only imagery in-app are **SVG icons** (Lucide, see below) and the **wordmark**. Marketing surfaces use minimal, warm cream backdrops.

---

## ICONOGRAPHY

**Library — [Lucide](https://lucide.dev/).** The codebase imports `lucide-react@^0.460.0` directly, and the Figma file's most-used icon instances (`Icon / ChevronDown`, `Icon / Circle`, `Icon / FilePenLine`, `Icon / Briefcase`, `Icon / SquareTerminal`, …) map 1:1 to Lucide names. The Figma also contains a small set of Heroicons (mini + solid) in secondary, legacy surfaces. **New work should use Lucide only.**

**Weight.** `strokeWidth={2}` for most UI icons; `strokeWidth={3}` on the Checkbox's check mark for legibility at `14×14px`.

**Sizing.**
- `h-3.5 w-3.5` (14 px) — inside form controls and table cells
- `h-4 w-4` (16 px) — nav, button icons, inline tips
- `h-5 w-5` (20 px) — section headers, summary-card icons, toggle-aligned controls
- `h-16 w-16` (64 px) — the lone success-confirmation moment at the end of the wizard

**Color.** Icons inherit `currentColor`. Never set a hard fill. The Checkbox / Toggle rely on this to flip from muted to primary.

**Emoji.** Never. Except as allowed glyphs inside chat transcript bubbles in the Hub (out of scope for this kit).

**Unicode.** Two allowed marks: `✎` for "edit this empty cell" and `✓` for a completed wizard step. Nothing else.

**In this system.** We don't ship a Lucide sprite; we load it from CDN in preview HTML (`https://unpkg.com/lucide@latest`). In production code the `lucide-react` package is the only way to reach the library.

---

## Substitutions flagged to the user

- **Slussen** (202 occurrences in the Figma file, marketing-only) is not freely licensable. The web specimens and UI kits substitute **Inter** for display text. Please send Slussen WOFF2 files (or a license) if you want accurate marketing comps.
- **Blackbird repo** is referenced in the brief but not installed on this GitHub App. If it contains additional tokens (dark-mode, Hub-specific), please install the app there: https://github.com/apps/claude-design-import/installations/new.
- The **Hub product** (live-call dashboard, flagged cases, analytics) is only present in Figma. We captured its tokens + icons but did not recreate any of its screens — recreating 1,000+ frames from pseudocode is out of scope for a single pass. Tell us which 1–3 screens to lift if you want a Hub UI kit.
