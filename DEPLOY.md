# AI Visibility Tracker — Supabase + Vercel Deploy Runbook

## The architecture (important — read first)

```
   ┌─────────────┐      reads        ┌──────────────┐
   │   Vercel    │  ───────────────▶ │   Supabase   │  ◀── source of truth
   │ (dashboard) │                   │ (Postgres)   │
   └─────────────┘                   └──────────────┘
                                            ▲
                                     writes │
                                  ┌───────────────────┐
                                  │  Shan's local Mac │  ◀── runs the audits
                                  │  (Claude + keys)  │
                                  └───────────────────┘
```

- **Vercel** hosts the dashboard. It only **reads** from Supabase + accepts pilot signups. It never runs audits (Vercel's serverless functions time out long before a 470-call audit finishes).
- **Audits run locally** on your Mac (where the Gemini/OpenAI keys live). When I run an audit, it writes straight into Supabase using the service-role key. Within seconds the live Vercel dashboard shows the new data.
- **Supabase** is the shared database both sides talk to.

So: Gemini/OpenAI keys only ever live locally. Vercel only needs the Supabase keys.

---

## Part 1 — Supabase (you, ~10 min)

1. Go to https://supabase.com → **New project**.
   - Name: `netic-aeo` (anything)
   - Region: **East US (North Virginia)** — closest to most clients
   - Set a database password and save it somewhere
2. Wait ~2 min for it to provision.
3. Left sidebar → **SQL Editor** → **New query** → paste everything from `supabase-schema.sql` (in this folder) → **Run**. You should see "Success."
4. Left sidebar → **Project Settings** → **API**. Copy these two values and send them to me (or paste into `.env.local`):
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **service_role** secret key (under "Project API keys" — the secret one, NOT anon)

That's all on Supabase. RLS is on with no public policies, so the database is only reachable with the service-role key (server-side only).

---

## Part 2 — GitHub (you create, I push)

Vercel deploys from a Git repo.

- Create an **empty private repo** at https://github.com/new (e.g. `netic-aeo`). Don't add a README.
- Tell me the repo URL and I'll push the code (I'll keep `.env.local` out of the commit — secrets never go to GitHub).

---

## Part 3 — Vercel (you, ~10 min)

1. https://vercel.com → **Add New… → Project** → **Import** the GitHub repo.
2. Framework preset auto-detects **Next.js** — leave build settings default.
3. Expand **Environment Variables** and add these three:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | (your Project URL from Part 1) |
   | `SUPABASE_SERVICE_ROLE_KEY` | (your service_role key from Part 1) |
   | `DEMO_MODE` | `false` |

   Do **not** add the Gemini/OpenAI keys to Vercel — the live site doesn't run audits.
4. Click **Deploy**. ~2 min later you get a `https://your-app.vercel.app` URL.

---

## Part 4 — Data migration (me, ~1 min)

Once you send me the Supabase URL + service-role key, I run one script locally that copies the current `db.json` (Hoffmann + AllTech real data) into Supabase. After that the Vercel site shows real data.

---

## Part 5 — Code still to build before public launch (me)

These aren't blockers for getting it live for your team, but are needed before sending links to real prospects:

1. **Signup capture** — wire the pilot landing form → `POST /api/signups` → a `signups` table (table is already in the SQL). You check signups in the Supabase dashboard; no email needed.
2. **Secret-link access** — each client gets a private `/share/<token>` URL (no login). You email it to them; it scopes to just their company.
3. **Remove the Setup tab** for clients; add an admin-only **Signups** view for you.

---

## Running an audit after go-live (the ongoing flow)

1. A prospect signs up on the pilot page → row appears in Supabase `signups`.
2. You tell me here: "run an audit for <company>, <address>."
3. I run it locally → it writes to Supabase.
4. I send you the client's secret link → you forward it. It stays live for 30 days (the "days left for access" countdown on the dashboard).
