import { readReportsLight, readCompanies } from "@/lib/store";

// Local index of the 30-market HVAC study — links to each market report (/?report=<id>).
// The 30 study cities with tier + region (excludes the Austin pilot).
const STUDY: Record<string, { tier: number; region: string }> = {
  "Phoenix": { tier: 1, region: "Southwest" }, "Houston": { tier: 1, region: "Gulf" }, "Atlanta": { tier: 1, region: "Southeast" },
  "Chicago": { tier: 1, region: "Midwest" }, "Denver": { tier: 1, region: "Mountain" }, "Seattle": { tier: 1, region: "Pacific NW" },
  "Tampa": { tier: 1, region: "Southeast" }, "San Francisco": { tier: 1, region: "West" }, "Los Angeles": { tier: 1, region: "West" },
  "Miami": { tier: 1, region: "Southeast" }, "Brooklyn": { tier: 1, region: "Northeast" }, "Boston": { tier: 1, region: "Northeast" },
  "Dallas": { tier: 1, region: "Gulf" }, "Washington": { tier: 1, region: "Mid-Atlantic" }, "Philadelphia": { tier: 1, region: "Northeast" },
  "Detroit": { tier: 1, region: "Midwest" }, "Minneapolis": { tier: 1, region: "Midwest" },
  "Charlotte": { tier: 2, region: "Southeast" }, "Nashville": { tier: 2, region: "South" }, "Kansas City": { tier: 2, region: "Midwest" },
  "Columbus": { tier: 2, region: "Midwest" }, "Sacramento": { tier: 2, region: "West" }, "Salt Lake City": { tier: 2, region: "Mountain" },
  "Richmond": { tier: 2, region: "Mid-Atlantic" },
  "Boise": { tier: 3, region: "Mountain" }, "Tulsa": { tier: 3, region: "South" }, "Des Moines": { tier: 3, region: "Midwest" },
  "Spokane": { tier: 3, region: "Pacific NW" }, "Fort Myers": { tier: 3, region: "Southeast" }, "Chattanooga": { tier: 3, region: "South" },
};
const TIER_LABEL: Record<number, string> = { 1: "Major metros", 2: "Mid-size metros", 3: "Smaller metros" };

// Never prerender. Uses the LIGHT report list + companies (no run payloads) so it stays fast
// as report count grows — readDb() would pull every report's multi-MB payload (~hundreds of
// MB at 80+ reports). Fail safe to an empty list if the read is unavailable.
export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  let rows: Array<{ id: string; city: string; state: string; prompts: number; meta?: { tier: number; region: string } }> = [];
  try {
    const [reports, companies] = await Promise.all([readReportsLight(), readCompanies()]);
    const coById = new Map(companies.map((c) => [c.id, c]));
    rows = reports
      .filter((r) => r.market && r.status === "complete")
      .map((r) => {
        const c = coById.get(r.companyId);
        const city = c?.locations?.[0]?.city || "";
        return { id: r.id, city, state: c?.locations?.[0]?.state || "", prompts: 25, meta: STUDY[city] };
      })
      .filter((r) => r.meta)
      .sort((a, b) => a.meta!.tier - b.meta!.tier || a.city.localeCompare(b.city));
  } catch {
    rows = [];
  }

  const tiers = [1, 2, 3].map((t) => ({ t, label: TIER_LABEL[t], items: rows.filter((r) => r.meta!.tier === t) }));

  return (
    <div className="mkx">
      <style>{STYLES}</style>
      <header className="mkx-head">
        <span className="mkx-eyebrow">Netic · AI Search Visibility</span>
        <h1>HVAC market reports — 30 U.S. markets</h1>
        <p>Each market’s AI-visibility leaderboard (Gemini · AI Mode · ChatGPT · SEO) with Google Business Profile ratings. Click a market to open its report.</p>
      </header>
      {tiers.map(({ t, label, items }) => (
        <section key={t} className="mkx-tier">
          <h2>{label} <span>{items.length}</span></h2>
          <div className="mkx-grid">
            {items.map((r) => (
              <a key={r.id} className="mkx-card" href={`/?report=${r.id}`}>
                <span className="mkx-city">{r.city}, {r.state}</span>
                <span className="mkx-region">{r.meta!.region}</span>
                <span className="mkx-go">Open report →</span>
              </a>
            ))}
          </div>
        </section>
      ))}
      <footer className="mkx-foot">{rows.length} markets · local links (served from this dev server) · HVAC vertical</footer>
    </div>
  );
}

const STYLES = `
.mkx{max-width:960px;margin:0 auto;padding:48px 28px 90px;color:var(--fg)}
.mkx-head{border-bottom:1px solid var(--border);padding-bottom:24px;margin-bottom:12px}
.mkx-eyebrow{font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--primary)}
.mkx-head h1{font-size:30px;font-weight:600;letter-spacing:-.02em;margin:10px 0 0;line-height:1.1}
.mkx-head p{font-size:14px;color:var(--fg-muted);margin:12px 0 0;max-width:64ch;line-height:1.5}
.mkx-tier{margin-top:34px}
.mkx-tier h2{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--fg-muted);margin:0 0 14px;display:flex;align-items:center;gap:8px}
.mkx-tier h2 span{background:var(--secondary,#f0efec);color:var(--fg-muted);font-size:11px;border-radius:var(--radius-full,999px);padding:2px 8px}
.mkx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.mkx-card{display:flex;flex-direction:column;gap:4px;padding:16px 16px 14px;border:1px solid var(--border);border-radius:var(--radius,10px);background:var(--bg);text-decoration:none;color:var(--fg);transition:border-color .15s,box-shadow .15s,transform .15s}
.mkx-card:hover{border-color:var(--primary);box-shadow:0 4px 14px -6px color-mix(in oklab,var(--primary) 40%,transparent);transform:translateY(-1px)}
.mkx-city{font-size:15px;font-weight:600;letter-spacing:-.01em}
.mkx-region{font-size:11.5px;color:var(--fg-muted)}
.mkx-go{font-size:12px;font-weight:500;color:var(--primary);margin-top:8px}
.mkx-foot{margin-top:44px;padding-top:18px;border-top:1px solid var(--border);font-size:12px;color:var(--fg-muted)}
`;
