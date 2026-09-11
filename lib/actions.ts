// Recommended actions, derived from a report — no hand-written advice.
//
// Every action here is produced from something the run actually measured: which
// cited sources never co-occur with the company, which prompt categories it is
// absent from, how far apart the engines are, whether AI only ever cites the
// homepage, which complaint phrases AI repeats, and who outperforms it.
//
// Two fields are NOT measured and are labelled as estimates in the UI:
//   impact  — ranked from the measured size of the gap, not predicted lift.
//   effort  — a fixed judgement per action type (claiming a listing is Low,
//             writing a page is Medium, rebuilding a page set is High).
// Everything else on an action is a number this report can defend.

export type ActionCategory = "Content" | "Citation" | "Website" | "Review" | "Competitor";
export type ActionImpact = "High" | "Medium" | "Low";
export type ActionEffort = "Low" | "Medium" | "High";

export type ActionEvidence =
  | { kind: "sources"; items: Array<{ name: string; count: number; on: boolean }>; total: number; foot?: string }
  | { kind: "coverage"; items: Array<{ name: string; on: boolean }>; foot?: string }
  | { kind: "queries"; items: Array<{ q: string; where: string; hits: number }>; foot?: string }
  | { kind: "quotes"; items: Array<{ phrase: string; count: number; quote?: string }>; foot?: string }
  | { kind: "versus"; items: Array<{ name: string; them: string; you: string }>; foot?: string }
  | { kind: "progress"; rows: Array<{ name: string; have: number; total: number }>; foot?: string };

export type Action = {
  id: string;
  category: ActionCategory;
  impact: ActionImpact;
  effort: ActionEffort;
  title: string;
  detail: string;
  gap: string;       // the measured figure
  gapLabel: string;  // what the figure counts
  evidence?: ActionEvidence;
  steps: string[];
};

export const ACTION_CATEGORIES: Array<{ key: ActionCategory; label: string; blurb: string; icon: string }> = [
  { key: "Content", label: "Content", blurb: "Do your pages say what AI needs to hear", icon: "copy" },
  { key: "Citation", label: "Citation", blurb: "Are you on the websites AI quotes most", icon: "menu" },
  { key: "Website", label: "Website", blurb: "Can AI read and understand your site", icon: "desktop" },
  { key: "Review", label: "Review", blurb: "What AI says about you, good and bad", icon: "spark" },
  { key: "Competitor", label: "Competitor", blurb: "Competitors worth studying in this market", icon: "target" }
];

export const IMPACTS: ActionImpact[] = ["High", "Medium", "Low"];
export const EFFORTS: ActionEffort[] = ["Low", "Medium", "High"];

/** Inputs are all pre-computed by the dashboard so this module stays pure. */
export type ActionInput = {
  company: string;
  market: string;
  trade: string;
  /** overall blended visibility, 0-1 */
  visibility: number;
  /** per-engine blended visibility, 0-1 */
  engines: Array<{ label: string; rate: number }>;
  /** prompt-category coverage on primary prompts */
  coverage: Array<{ category: string; total: number; mentioned: number; rate: number }>;
  /** per-service coverage, derived from the query list */
  services: Array<{ service: string; total: number; mentioned: number; rate: number }>;
  /** cited domains, most-cited first, with whether the company was ever named alongside */
  sources: Array<{ domain: string; count: number; withCompany: number; owned: boolean }>;
  /** the company's own cited URLs */
  ownedUrls: Array<{ url: string; count: number }>;
  /** complaint phrases AI repeated about the company */
  complaints: Array<{ phrase: string; count: number; quote?: string }>;
  /** share of answers about the company that read positive, 0-1 */
  sentiment: number | null;
  /** competitors by blended visibility, best first */
  rivals: Array<{ name: string; visibility: number; mentions: number }>;
  /** the company's own total mentions */
  mentions: number;
  /** prompts the company never appears on, with where they ran */
  missingPrompts: Array<{ q: string; where: string; hits: number }>;
};

const pct = (v: number) => Math.round(v * 100) + "%";
const num = (v: number) => v.toLocaleString();

/* ── individual builders ─────────────────────────────────────────────────── */

// Sources that get cited in this market but never alongside this company. A domain
// cited 100 times that never once appears in an answer naming you is strong evidence
// you are not represented on it — stated as "never cited alongside you", which is
// exactly what was measured, rather than claiming you have no profile there.
function citationActions(input: ActionInput): Action[] {
  const top = input.sources.filter((s) => !s.owned).slice(0, 10);
  if (top.length < 3) return [];
  const absent = top.filter((s) => s.withCompany === 0);
  if (!absent.length) return [];
  const total = top.reduce((sum, s) => sum + s.count, 0);
  const lost = absent.reduce((sum, s) => sum + s.count, 0);
  const share = total ? lost / total : 0;
  return [{
    id: "cite-absent",
    category: "Citation",
    impact: share >= 0.25 ? "High" : "Medium",
    effort: "Low",
    title: absent.length <= 2
      ? "Get listed on " + absent.slice(0, 2).map((s) => s.domain).join(" and ")
      : "Get listed on " + absent.length + " more sites AI quotes",
    detail: "You appear alongside " + (top.length - absent.length) + " of the " + top.length + " sites AI quotes most here",
    gap: num(lost),
    gapLabel: "times AI quoted a site without you",
    evidence: {
      kind: "sources",
      total,
      items: top.map((s) => ({ name: s.domain, count: s.count, on: s.withCompany > 0 })),
      foot: "The " + top.length + " sites AI quoted most for " + input.trade.toLowerCase() + " in " + input.market
        + ", across " + num(total) + " mentions. “Missing” means AI never named you in an answer that cited that site."
    },
    steps: absent.slice(0, 3).map((s) => s.domain + " — AI quoted it " + num(s.count) + " times here, never alongside you")
      .concat(["Getting onto the " + Math.min(3, absent.length) + " biggest covers "
        + pct(absent.slice(0, 3).reduce((sum, s) => sum + s.count, 0) / (total || 1)) + " of everything AI quotes here"])
  }];
}

// One engine far behind the others is a distribution problem, not a content problem.
function engineActions(input: ActionInput): Action[] {
  if (input.engines.length < 2) return [];
  const sorted = [...input.engines].sort((a, b) => b.rate - a.rate);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const spread = best.rate - worst.rate;
  if (spread < 0.2) return [];
  return [{
    id: "engine-spread",
    category: "Citation",
    impact: spread >= 0.35 ? "High" : "Medium",
    effort: "Low",
    title: "Close the gap on " + worst.label,
    detail: pct(worst.rate) + " on " + worst.label + " against " + pct(best.rate) + " on " + best.label,
    gap: Math.round(spread * 100) + " pt",
    gapLabel: "gap between your best and worst engine",
    evidence: {
      kind: "progress",
      rows: sorted.map((e) => ({ name: e.label, have: Math.round(e.rate * 100), total: 100 })),
      foot: best.label + " already finds you, so the content exists. " + worst.label
        + " leans on different sources, which is where the gap comes from."
    },
    steps: [
      best.label + " names you on " + pct(best.rate) + " of questions, " + worst.label + " on " + pct(worst.rate),
      "The fix sits in the citation list above, not in new pages"
    ]
  }];
}

// Demand the company is absent from. Thresholds are absolute-first: a service the
// company is NEVER named on is always worth an action, and everything else is judged
// against the company's OWN best service rather than against overall visibility —
// a relative-to-overall threshold gets more lenient as a company gets weaker, which
// is precisely backwards.
function contentActions(input: ActionInput): Action[] {
  const out: Action[] = [];
  const usable = input.services.filter((s) => s.total >= 2);
  if (!usable.length) return out;
  const best = Math.max(...usable.map((s) => s.rate));

  const blank = usable.filter((s) => s.mentioned === 0).sort((a, b) => b.total - a.total);
  const behind = usable
    .filter((s) => s.mentioned > 0 && best - s.rate >= 0.25)
    .sort((a, b) => a.rate - b.rate);
  const picks = [...blank, ...behind].slice(0, 2);

  picks.forEach((s, index) => {
    const zero = s.mentioned === 0;
    out.push({
      id: "content-service-" + index,
      category: "Content",
      impact: zero && s.total >= 3 ? "High" : "Medium",
      effort: "Medium",
      title: "Show up for " + s.service.toLowerCase() + " jobs",
      detail: zero
        ? "AI never names you on any of the " + s.total + " " + s.service.toLowerCase() + " questions"
        : "AI names you on " + pct(s.rate) + " of " + s.service.toLowerCase()
          + " questions, against " + pct(best) + " on your best service",
      gap: zero ? "0 of " + s.total : pct(s.rate),
      gapLabel: zero ? s.service.toLowerCase() + " questions" : "of " + s.service.toLowerCase() + " questions",
      evidence: {
        kind: "progress",
        rows: [...usable].sort((a, b) => b.rate - a.rate).slice(0, 8)
          .map((row) => ({ name: row.service, have: row.mentioned, total: row.total })),
        foot: "How often AI named you, by service, on high-intent questions."
      },
      steps: [
        "You are named on " + s.mentioned + " of " + s.total + " " + s.service.toLowerCase() + " questions",
        zero
          ? "Nothing on your site is answering this group of questions"
          : "Your best service runs at " + pct(best) + ", so this is a content gap rather than a ceiling"
      ]
    });
  });

  // weakest question type, judged against the company's own strongest
  const cov = input.coverage.filter((c) => c.total >= 3);
  if (cov.length >= 2) {
    const sorted = [...cov].sort((a, b) => a.rate - b.rate);
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    if (high.rate - low.rate >= 0.2) {
      out.push({
        id: "content-category",
        category: "Content",
        impact: low.rate === 0 ? "High" : "Medium",
        effort: "Medium",
        title: "Answer the \u201c" + low.category.toLowerCase() + "\u201d questions buyers ask",
        detail: "You appear on " + low.mentioned + " of " + low.total + " " + low.category.toLowerCase()
          + " questions, against " + pct(high.rate) + " on " + high.category.toLowerCase(),
        gap: pct(low.rate),
        gapLabel: "of " + low.category.toLowerCase() + " questions",
        evidence: {
          kind: "progress",
          rows: cov.map((c) => ({ name: c.category, have: c.mentioned, total: c.total })),
          foot: "Coverage by question type, on high-intent prompts only."
        },
        steps: [
          low.category + " is your weakest question type and " + high.category + " your strongest",
          "The gap between them is " + Math.round((high.rate - low.rate) * 100) + " points"
        ]
      });
    }
  }
  return out;
}

// If AI only ever cites the root domain, it has not found a page that answers the
// question — it just knows the brand exists.
function websiteActions(input: ActionInput): Action[] {
  if (!input.ownedUrls.length) {
    return [{
      id: "site-uncited",
      category: "Website",
      impact: "High",
      effort: "Medium",
      title: "Give AI a page it can quote",
      detail: "AI never cited your website in this market",
      gap: "0",
      gapLabel: "of your pages were quoted",
      evidence: {
        kind: "coverage",
        items: input.sources.slice(0, 6).map((s) => ({ name: s.domain, on: false })),
        foot: "AI quoted these sites for this market and none of your own pages."
      },
      steps: [
        "Every citation in this market points at somewhere other than your site",
        "AI can only point people at pages that exist and answer the question"
      ]
    }];
  }
  const total = input.ownedUrls.reduce((sum, u) => sum + u.count, 0);
  const isRoot = (url: string) => {
    try { const p = new URL(url).pathname.replace(/\/+$/, ""); return p === "" || p === "/"; } catch { return false; }
  };
  const rootCount = input.ownedUrls.filter((u) => isRoot(u.url)).reduce((sum, u) => sum + u.count, 0);
  const deep = input.ownedUrls.filter((u) => !isRoot(u.url));
  if (total && rootCount / total >= 0.6) {
    return [{
      id: "site-homepage-only",
      category: "Website",
      impact: deep.length === 0 ? "High" : "Medium",
      effort: "Medium",
      title: "Make sure your website speaks the AI language",
      detail: pct(rootCount / total) + " of the times AI quoted your site, it quoted the homepage",
      gap: num(rootCount) + " of " + num(total),
      gapLabel: "quotes were your homepage",
      evidence: {
        kind: "progress",
        rows: [
          { name: "Homepage", have: rootCount, total },
          { name: "Service and city pages", have: total - rootCount, total }
        ],
        foot: "A homepage quote means AI knows your brand. A service-page quote means it found a page that answers the question."
      },
      steps: [
        "AI quoted your homepage " + num(rootCount) + " times and your other pages " + num(total - rootCount),
        "Homepage-only quoting usually means the deeper pages are not readable or not specific enough"
      ]
    }];
  }
  return [];
}

// Complaint phrases AI actually repeated, with counts.
function reviewActions(input: ActionInput): Action[] {
  const themes = input.complaints.filter((c) => c.count >= 2).slice(0, 4);
  if (!themes.length) return [];
  const worst = themes[0];
  const low = input.sentiment !== null && input.sentiment < 0.8;
  return [{
    id: "review-complaints",
    category: "Review",
    impact: low ? "High" : "Medium",
    effort: "High",
    title: themes.length > 1
      ? "Fix the " + themes.length + " complaints AI keeps repeating"
      : "Fix the complaint AI keeps repeating",
    detail: input.sentiment !== null
      ? pct(input.sentiment) + " of what AI says about you reads positive"
      : "AI repeats “" + worst.phrase + "” when it describes you",
    gap: num(themes.reduce((sum, t) => sum + t.count, 0)),
    gapLabel: "answers raised these",
    evidence: {
      kind: "quotes",
      items: themes,
      foot: "Phrases AI used about you across answers in this market."
    },
    steps: themes.slice(0, 3).map((t) => "“" + t.phrase + "” came up in " + t.count + " answers")
      .concat(["These come from your reviews, so the fix is operational rather than on the website"])
  }];
}

// The competitor beating you on the least exposure, and the one at the top.
function competitorActions(input: ActionInput): Action[] {
  const above = input.rivals.filter((r) => r.visibility > input.visibility);
  if (!above.length) return [];
  const leader = above[0];
  const lean = [...above].sort((a, b) => a.mentions - b.mentions)[0];
  const items = [{
    name: leader.name,
    them: pct(leader.visibility) + " visibility",
    you: pct(input.visibility)
  }];
  if (lean.name !== leader.name) {
    items.push({ name: lean.name, them: num(lean.mentions) + " mentions", you: num(input.mentions) });
  }
  return [{
    id: "study-outliers",
    category: "Competitor",
    impact: "Medium",
    effort: "Low",
    title: above.length > 1 ? "Look at the two competitors worth copying" : "Look at the competitor ahead of you",
    detail: leader.name + " leads at " + pct(leader.visibility) + " against your " + pct(input.visibility),
    gap: String(above.length),
    gapLabel: "competitors ahead of you",
    evidence: {
      kind: "versus",
      items,
      foot: lean.name !== leader.name
        ? lean.name + " is ahead of you on " + num(lean.mentions) + " total mentions against your " + num(input.mentions) + "."
        : undefined
    },
    steps: [
      leader.name + " is the one to match in this market",
      lean.name !== leader.name
        ? lean.name + " is ahead on far less exposure, which is the cheaper example to copy"
        : "Open their pages next to yours before scoping anything above"
    ]
  }];
}

/* ── assembly ────────────────────────────────────────────────────────────── */

export function buildActions(input: ActionInput): Action[] {
  return [
    ...citationActions(input),
    ...engineActions(input),
    ...contentActions(input),
    ...websiteActions(input),
    ...reviewActions(input),
    ...competitorActions(input)
  ];
}

/** Impact first, then cheapest effort, then category — the quickest win at each level. */
export function sortActions(list: Action[], key: "category" | "title" | "effort" | "impact", dir: number): Action[] {
  const catIndex = (a: Action) => ACTION_CATEGORIES.findIndex((c) => c.key === a.category);
  const primary = (a: Action, b: Action) => {
    if (key === "category") return catIndex(a) - catIndex(b);
    if (key === "title") return a.title.localeCompare(b.title);
    if (key === "effort") return EFFORTS.indexOf(a.effort) - EFFORTS.indexOf(b.effort);
    return IMPACTS.indexOf(a.impact) - IMPACTS.indexOf(b.impact);
  };
  return [...list].sort((a, b) =>
    primary(a, b) * dir
    || IMPACTS.indexOf(a.impact) - IMPACTS.indexOf(b.impact)
    || EFFORTS.indexOf(a.effort) - EFFORTS.indexOf(b.effort)
    || catIndex(a) - catIndex(b)
  );
}
