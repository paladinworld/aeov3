// Fixed 30-market study — rendered from this static list with NO DB query. A "light"
// payload->>status/market scan over all reports was ~7s (Postgres detoasts every huge report
// payload just to read a scalar). Since the study is a fixed set, embed the ids. Update this
// list only if the study is re-run with new report ids.
const MARKETS: Array<{ city: string; state: string; tier: number; region: string; id: string }> = [
  { city: "Atlanta", state: "GA", tier: 1, region: "Southeast", id: "report_mr2s25td_6f5l1j" },
  { city: "Boise", state: "ID", tier: 3, region: "Mountain", id: "report_mr2vxeee_mxkzdk" },
  { city: "Boston", state: "MA", tier: 1, region: "Northeast", id: "report_mr2zgr7t_ib2wxc" },
  { city: "Brooklyn", state: "NY", tier: 1, region: "Northeast", id: "report_mr2ydqv5_09l3zh" },
  { city: "Charlotte", state: "NC", tier: 2, region: "Southeast", id: "report_mr2txvka_rnp93a" },
  { city: "Chattanooga", state: "TN", tier: 3, region: "South", id: "report_mr2xlpub_ce1xd4" },
  { city: "Chicago", state: "IL", tier: 1, region: "Midwest", id: "report_mr2sdn3x_zhkkgj" },
  { city: "Columbus", state: "OH", tier: 2, region: "Midwest", id: "report_mr2uuidx_ft60yl" },
  { city: "Dallas", state: "TX", tier: 1, region: "Gulf", id: "report_mr2ztlt5_3sr2q2" },
  { city: "Denver", state: "CO", tier: 1, region: "Mountain", id: "report_mr2sozpq_gucwwt" },
  { city: "Des Moines", state: "IA", tier: 3, region: "Midwest", id: "report_mr2wlbea_99pm5c" },
  { city: "Detroit", state: "MI", tier: 1, region: "Midwest", id: "report_mr30u3sh_2u1tct" },
  { city: "Fort Myers", state: "FL", tier: 3, region: "Southeast", id: "report_mr2x9w1t_fzmcle" },
  { city: "Houston", state: "TX", tier: 1, region: "Gulf", id: "report_mr2rqcgq_8j4d8k" },
  { city: "Kansas City", state: "MO", tier: 2, region: "Midwest", id: "report_mr2ul34v_4gj5jc" },
  { city: "Los Angeles", state: "CA", tier: 1, region: "West", id: "report_mr2z4cyp_kq1d45" },
  { city: "Miami", state: "FL", tier: 1, region: "Southeast", id: "report_mr2yrid3_q2jwfv" },
  { city: "Minneapolis", state: "MN", tier: 1, region: "Midwest", id: "report_mr316yqm_t7l7wa" },
  { city: "Nashville", state: "TN", tier: 2, region: "South", id: "report_mr2u9f51_xws9gs" },
  { city: "Philadelphia", state: "PA", tier: 1, region: "Northeast", id: "report_mr30i35v_zjrz0d" },
  { city: "Phoenix", state: "AZ", tier: 1, region: "Southwest", id: "report_mr2rawb8_y7ldno" },
  { city: "Richmond", state: "VA", tier: 2, region: "Mid-Atlantic", id: "report_mr2vlb3b_t9y7j8" },
  { city: "Sacramento", state: "CA", tier: 2, region: "West", id: "report_mr2v46cu_wq0qy6" },
  { city: "Salt Lake City", state: "UT", tier: 2, region: "Mountain", id: "report_mr2vcisf_cx88hc" },
  { city: "San Francisco", state: "CA", tier: 1, region: "West", id: "report_mr2y1t52_eo6egt" },
  { city: "Seattle", state: "WA", tier: 1, region: "Pacific NW", id: "report_mr2t11hi_49zud7" },
  { city: "Spokane", state: "WA", tier: 3, region: "Pacific NW", id: "report_mr2wxrw3_dfe0ia" },
  { city: "Tampa", state: "FL", tier: 1, region: "Southeast", id: "report_mr2tdxmr_kyllae" },
  { city: "Tulsa", state: "OK", tier: 3, region: "South", id: "report_mr2w9fif_74ys2z" },
  { city: "Washington", state: "DC", tier: 1, region: "Mid-Atlantic", id: "report_mr305lhx_z81dyp" },
];
const TIER_LABEL: Record<number, string> = { 1: "Major metros", 2: "Mid-size metros", 3: "Smaller metros" };

// Never prerender. Uses the LIGHT report list + companies (no run payloads) so it stays fast
// as report count grows — readDb() would pull every report's multi-MB payload (~hundreds of
// MB at 80+ reports). Fail safe to an empty list if the read is unavailable.
export const dynamic = "force-static";

export default function MarketsPage() {
  const rows = MARKETS.map((m) => ({ id: m.id, city: m.city, state: m.state, meta: { tier: m.tier, region: m.region } }));
  const tiers = [1, 2, 3].map((t) => ({ t, label: TIER_LABEL[t], items: rows.filter((r) => r.meta.tier === t) }));

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
      <footer className="mkx-foot">{rows.length} markets · HVAC vertical</footer>
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
