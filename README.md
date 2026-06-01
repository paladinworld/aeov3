# AEO V3 — Netic AI Visibility Tracker

The Netic **AI Visibility Tracker**, rebuilt to the latest **Claude design** on top of
the existing aeolist backend (Next.js 15 · React 19 · Supabase · Zod).

It tracks how often a home-services company is recommended when homeowners ask AI
assistants (ChatGPT, Gemini) high-intent local questions, and benchmarks that against
local competitors — visibility score, share of voice, citations, and sentiment.

## What's here

- **`app/page.tsx`** — the V3 dashboard (6 views): Overview (semicircular visibility-score
  gauge + by-platform bars, share-of-voice / citation-rate / top-position / first-mention
  cards, two leaderboards, citation-domain rank, score-by-prompt-type), Prompts, Citations,
  **Competitors**, Sentiment, Setup. Wired to the live API.
- **`app/pilot/page.tsx`** — the Pilot Signup landing page (branching signup flow + bento
  collage hero).
- **`app/styles-v3.ts`**, **`app/pilot/styles.ts`** — design-system styles (Netic tokens).
- **`app/globals.css`** — Netic Design System tokens (colors, type, spacing, radii).
- **`lib/`**, **`app/api/`**, **`database/`** — unchanged aeolist backend (providers,
  scoring, store, runner, query generator).
- **`design-reference/`** — the original Claude design prototype (read-only reference).
- **`app/v2/`** — the previous redesign route, kept for reference.

## Run it (offline demo, no API keys)

```bash
npm install
npm run dev                 # http://localhost:3000
node scripts/seed-demo.mjs  # seeds the Hoffmann Brothers demo account
```

`.env.local` sets `DEMO_MODE=true`, so every AI provider uses the deterministic mock and
data persists to `data/db.json` (no Supabase needed). The dashboard defaults to the
**Hoffmann Brothers** account. The landing page lives at **`/pilot`**.

## Going live

To run real audits, create `.env.local` with the provider keys (see `.env.example`):
`GEMINI_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AIO_PROVIDER_API_KEY`, and the `SUPABASE_*`
keys for persistence. Set `DEMO_MODE=false` to hit the live providers.
