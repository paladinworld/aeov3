# AEO V3 — Audit Run Runbook (the fixated process)

The deterministic, end-to-end process for running an AI-visibility audit for a company.
Written so the process lives in the repo, not in anyone's head. Follow top to bottom.

> **TL;DR of the maturation plan** (see bottom): most of this should become a one-command
> CLI + a local "Run Audit" panel. Until then, this is the manual recipe.

---

## 0. Key facts (so you don't have to remember them)

- **App:** Next.js at `~/Projects/AEO V3`, repo `paladinworld/aeov3`. Dev server on **:3000** (`npm run dev`).
- **Data mode:** local dev = **file mode** (`data/db.json`) because `SUPABASE_SERVICE_ROLE_KEY` is **blank** in `.env.local`. So local runs never touch prod. Prod (Vercel) reads its own Supabase (`ipmguqnjhrvjgqmzvtkk`).
- **3 scored engines** (blended 40 / 30 / 30):
  - `gemini_search` → **Google Gemini** — Vertex AI, model `gemini-3.5-flash`, `global` endpoint, project `ai-search-tool-499223`. Auth = ADC.
  - `google_ai_overview` → **Google AI Mode** ⚠️ *the key is a legacy misnomer*. It actually calls **DataForSEO AI Mode** (`/v3/serp/google/ai_mode/live/advanced`, ~$0.004/query) via `lib/providers/google-aio.ts`. NOT AI Overview.
  - `chatgpt_search` → **ChatGPT** — OpenAI web search (gpt-5.5 primary / gpt-5 secondary).
  - `gemini_maps` is collected-but-excluded (local SEO, not AI visibility).
- **Standard:** 40 prompts × **5 repeats** per engine.
- **Secrets** in `.env.local` (gitignored): `GEMINI_*` (Vertex), `OPENAI_API_KEY`, `DATAFORSEO_B64`, `ACCESS_SECRET` (blank locally), `SUPABASE_*` (service key blank locally).

---

## 1. Pre-flight (check BEFORE every run — a 30-min run that dies on auth is the failure mode)

```bash
cd ~/Projects/AEO\ V3
# Vertex auth valid? Auth is a SERVICE-ACCOUNT KEY (GOOGLE_APPLICATION_CREDENTIALS in
# .env.local → aeo-audit-runner@…), which DOES NOT expire — the lib auto-mints ~1h tokens.
# Check the SA the way the app does. Do NOT use `gcloud auth application-default
# print-access-token` — that tests your PERSONAL user ADC, a different credential the
# audits don't use; it expires constantly and is a false alarm (cost us several needless re-auths).
node -e 'import("google-auth-library").then(async({GoogleAuth})=>{process.env.GOOGLE_APPLICATION_CREDENTIALS=require("fs").readFileSync(".env.local","utf8").match(/^GOOGLE_APPLICATION_CREDENTIALS=(.*)$/m)[1];const a=new GoogleAuth({scopes:"https://www.googleapis.com/auth/cloud-platform"});const t=await(await a.getClient()).getAccessToken();console.log(t.token?"SA AUTH OK ("+(await a.getCredentials()).client_email+")":"SA AUTH FAILED")})' 2>&1 || echo "SA AUTH FAILED -> check GOOGLE_APPLICATION_CREDENTIALS path / key validity"
# Dev server up?
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/   # want 200; else: npm run dev
# DataForSEO balance (AI Mode)?
curl -s -H "Authorization: Basic $(grep -oE '^DATAFORSEO_B64=.*' .env.local | cut -d= -f2-)" https://api.dataforseo.com/v3/appendix/user_data | grep -o '"balance":[0-9.]*'
# Nothing already running? (don't create/run while a run is in flight — checkpoint writes clobber)
node -e 'const d=require("./data/db.json");console.log("running:",d.reports.filter(r=>r.status==="running").map(r=>r.id))'
```

**If ADC is expired:** `gcloud auth application-default login` → pick the `ai-search-tool-499223` account. (This is the #1 recurring blocker — see maturation item #2.)

---

## 2. Inputs you need

- **Company name** (recognizable form — helps target matching)
- **Website**
- **Service area:** city + 2-letter state
- **Vertical:** `HVAC` (default). Services default to the 10 HVAC services.

---

## 3. Create company + report (admin-gated APIs; gate is OFF locally since `ACCESS_SECRET` is blank, but the cookie is harmless)

One node script — mints an admin cookie, creates the company (single primary location), creates the report (`repeatRuns:5`), then **injects the AI Mode surface** into every query (the query generator omits it — see maturation item #1):

```js
// scripts/_create.mjs  (or inline)  — set NAME/URL/CITY/STATE first
const fs=require("fs"),crypto=require("crypto");
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const b=Buffer.from(JSON.stringify({reports:["*"],email:"admin@netic.local",exp:Date.now()+3600e3})).toString("base64url");
const cookie="aeo_access="+b+"."+crypto.createHmac("sha256",env.ACCESS_SECRET||"").update(b).digest("base64url");
const SERVICES=["AC repair","AC installation","Furnace repair","Furnace installation","Heat pump repair","Ductless mini split","Indoor air quality","Duct cleaning","Emergency HVAC","Maintenance/tune-up"];
const NAME="Frymire Home Services", URL="https://frymire.com/", LABEL="Dallas Service Area", CITY="Dallas", STATE="TX";
(async()=>{
  let r=await fetch("http://127.0.0.1:3000/api/companies",{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({name:NAME,website:URL,services:SERVICES,competitors:[],locations:[{label:LABEL,city:CITY,state:STATE,isPrimary:true}]})});
  const co=await r.json();
  r=await fetch("http://127.0.0.1:3000/api/reports",{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({companyId:co.id,locationIds:[co.locations[0].id],vertical:"HVAC",repeatRuns:5})});
  const rep=await r.json();
  const db=JSON.parse(fs.readFileSync("data/db.json","utf8"));
  const stored=db.reports.find(x=>x.id===rep.id);
  for(const q of stored.queries) if(!q.surfaces.includes("google_ai_overview")) q.surfaces.push("google_ai_overview"); // <-- the manual injection
  fs.writeFileSync("data/db.json",JSON.stringify(db,null,2));
  console.log("REPORT="+rep.id);
})();
```

Verify the prompts carry the right city (`best HVAC company in <City>, <ST>`) and surfaces include `google_ai_overview`.

---

## 4. Run it (all 3 engines × 5 repeats)

```bash
# full run, no body = all surfaces; ~15-18 min; safe to background
curl -s -X POST http://127.0.0.1:3000/api/reports/<REPORT_ID>/run -H "Content-Type: application/json" -d '{}'
```

- **Run MULTIPLE reports SEQUENTIALLY, never concurrently** (each run loads the whole db in memory + checkpoints — concurrent runs clobber each other).
- If Gemini dies mid-run with `invalid_grant` → ADC expired → re-auth → `POST /api/reports/<id>/retry-failed` (redoes only failed runs).

---

## 5. Verify the readout

```bash
node -e 'const db=require("./data/db.json");const r=db.reports.find(x=>x.id==="<REPORT_ID>");
for(const s of ["gemini_search","google_ai_overview","chatgpt_search"]){const real=r.runs.filter(x=>x.surface===s&&!String(x.rawAnswer).startsWith("Provider error:"));const m=real.filter(x=>(x.mentions||[]).some(z=>z.isTarget)).length;console.log(s,Math.round(100*m/real.length)+"%","("+real.length+" runs)")}'
```

Sanity: 540 runs total (gemini 200 / ai_mode 200 / chatgpt 140), ~0 errors, citations look real (no `*demo answer*`, no `google.com/searchviewer` junk).

---

## 6. (Optional) Push to prod + share link

Prod = Supabase `ipmguqnjhrvjgqmzvtkk` (the dashboard reads it). Local `.env.local` has a **blank** service-role key, so use the **prod** key (from the `aisearch` Vercel project env) in a one-off — do **not** write it into `.env.local`.

- **Selective upsert** (only this report + its company; never the full `migrate-to-supabase.mjs`, which clobbers prod):
  `POST <SB_URL>/rest/v1/companies` `[{id,payload,created_at,updated_at}]` and `/reports` `[{id,company_id,payload,...}]` with header `Prefer: resolution=merge-duplicates`.
- **No-login share link:** `signGrant({reports:[id],email,exp})` HMAC-SHA256 with the **prod `ACCESS_SECRET`** → share as `https://aisearch-neticlabs.vercel.app/?report=<id>&t=<token>` (no redirect, no login; the read APIs accept `?t=`).

See memory `aeo_v3_deploy.md` for the Vercel scope gotcha (dashboard is under the `neticlabs` team `team_jPTLDTsQ…`, **not** `netic-gtm`).

---

## Gotchas (the things that bit us)

1. **Vertex ADC expires** → interactive `gcloud auth application-default login`. No service-account key on disk (yet — item #2).
2. **Never create/edit `data/db.json` while a run is in flight** (including its post-processing) — the run's final write clobbers it. "540 runs" ≠ done; wait for `status:"complete"`.
3. **Local is file-mode** (blank Supabase key) → local work never hits prod. Going live is a deliberate selective upsert.
4. **`google_ai_overview` = AI Mode** (DataForSEO `ai_mode/live/advanced`), despite the key name. The `constants.ts` SURFACE_LABELS still mislabels it "Google AI Overview" — cosmetic bug.
5. **Mock detection:** if a surface's `rawAnswer` starts with `"<surface> demo answer for…"`, it's the stub — never ship it.
6. **A POST'd run is fire-and-forget on the SERVER.** Killing the `curl` (or `TaskStop` on the background client) only drops the client connection — the Next route handler keeps running the audit to completion and keeps checkpointing `db.json`. There is no cancel endpoint. The **only** reliable way to stop a run is to **restart the dev server** (`lsof -ti:3000 | xargs kill -9` → `npm run dev`). If you edit `db.json` thinking a killed run is dead, the still-alive run will clobber your edits (this is gotcha #2 in disguise).
7. **Region-style markets break DataForSEO AI Mode.** "Long Island, NY", "Inland Empire", "Bay Area", "DMV" are not DataForSEO cities → `40501 Invalid Field: 'location_name'` → AI Mode zeroes out (Gemini/ChatGPT still work, so it's easy to miss). Fixed in `lib/providers/google-aio.ts`: a `REGION_ALIASES` map (region → a real city inside it, e.g. Long Island→Hempstead) + a state-level retry on 40501. Add new regions to that map.
8. **`POST /api/reports` does NOT validate that `locationIds` exist** — any non-empty string passes the zod schema. Passing a bogus id (e.g. `"__primary__"`) creates a real report that runs **0 checks** and "completes" instantly. Always pass the company's real `loc_…` id.

---

## Maturation plan (to remove the manual fragility)

1. **Codify AI Mode injection** — add `"google_ai_overview"` to `LOCAL` + `NATIONAL` in `lib/query-generator.ts:8-9`. Then every new report auto-includes AI Mode (kills the §3 hand-patch). Also fix the stale `constants.ts` label → "Google AI Mode". *(~5 min)*
2. **Service-account auth for Vertex** — replace personal ADC with a service-account key (`GOOGLE_APPLICATION_CREDENTIALS`) so runs never need an interactive re-login. *(removes gotcha #1)*
3. **One-command audit CLI** — `npm run audit -- --name --url --city --state --vertical [--push]` that does create → inject → run → (optional) push + mint link. This script becomes the canonical process.
4. **Local "Run Audit" panel** — a small form (name/url/city/state/vertical) + button over the CLI, with pre-flight health checks (ADC, DFS balance, server) surfaced before you click. (Same pattern as the Reports Tracker on :3100.)
