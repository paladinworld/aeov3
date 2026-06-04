"use client";

import { useState } from "react";
import { pilotStyles } from "./styles";

const WORDMARK_GREEN = "/netic/netic-wordmark-green.svg";

type Revenue = { id: string; label: string; note: string };

const REVENUE: Revenue[] = [
  { id: "<15M", label: "Under $15M", note: "" },
  { id: "15-20M", label: "$15M – $20M", note: "" },
  { id: "20-60M", label: "$20M – $60M", note: "" },
  { id: "60-100M", label: "$60M – $100M", note: "" },
  { id: "100M+", label: "$100M+", note: "" },
];

const INDUSTRY = ["Home Services", "Wellness & Fitness", "Automotive", "Healthcare", "Pet Services", "Insurance", "Other"];

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
  );
}
function Clock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  );
}
function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
  );
}
function Back() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
  );
}

const emailOk = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

type Cite = { domain: string; count: number; owned: boolean };

const CITES: Cite[] = [
  { domain: "houzz.com", count: 15, owned: false },
  { domain: "summitcomfort.com", count: 13, owned: true },
  { domain: "mapquest.com", count: 13, owned: false },
  { domain: "nextdoor.com", count: 12, owned: false },
];

type Rank = { rk: number; nm: string; v: number; you?: boolean };

const RANK: Rank[] = [
  { rk: 1, nm: "Brightway Heating & Air", v: 72 },
  { rk: 2, nm: "You", v: 55, you: true },
  { rk: 3, nm: "Northpoint Plumbing & HVAC", v: 49 },
  { rk: 4, nm: "Hearthside Heating & Cooling", v: 41 },
];

/* ── Semicircular visibility gauge ── */
function Gauge({ value }: { value: number }) {
  const cx = 100, cy = 100, r = 78, sw = 15;
  const toRad = (v: number) => (180 - v * 1.8) * Math.PI / 180;
  const pt = (v: number, rad = r): [number, number] => {
    const a = toRad(v);
    return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)];
  };
  const seg = (a: number, b: number) => {
    const [x1, y1] = pt(a);
    const [x2, y2] = pt(b);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const aRad = toRad(value);
  const markBaseR = r - sw / 2 - 13;
  const markTipR = r - sw / 2 - 1;
  const bc = pt(value, markBaseR);
  const tipP = pt(value, markTipR);
  const tang = aRad + Math.PI / 2;
  const hw = 6.5;
  const b1: [number, number] = [bc[0] + hw * Math.cos(tang), bc[1] - hw * Math.sin(tang)];
  const b2: [number, number] = [bc[0] - hw * Math.cos(tang), bc[1] + hw * Math.sin(tang)];
  const ticks = [
    { v: 0, t: "0" }, { v: 25, t: "25" }, { v: 50, t: "50" },
    { v: 75, t: "75" }, { v: 100, t: "100" },
  ];

  return (
    <svg className="gauge-svg" viewBox="-2 -4 204 124" role="img">
      <path className="gtrack" d={seg(0, 100)} strokeWidth={sw} />
      <path d={seg(1, 19)} stroke="var(--destructive)" strokeWidth={sw} strokeLinecap="round" fill="none" />
      <path d={seg(21, 29)} stroke="var(--warning)" strokeWidth={sw} strokeLinecap="round" fill="none" />
      <path d={seg(31, 99)} stroke="var(--success)" strokeWidth={sw} strokeLinecap="round" fill="none" />
      {ticks.map((k) => {
        const [tx, ty] = pt(k.v, r + 13);
        return <text key={k.v} className="gtick" x={tx} y={ty + 3.5} textAnchor="middle">{k.t}</text>;
      })}
      <polygon className="gneedle"
        points={`${tipP[0].toFixed(2)},${tipP[1].toFixed(2)} ${b1[0].toFixed(2)},${b1[1].toFixed(2)} ${b2[0].toFixed(2)},${b2[1].toFixed(2)}`} />
    </svg>
  );
}

/* ── Brand hero (right) — bento collage ── */
function Hero() {
  return (
    <div className="hero">
      <div className="hero-content">
        <h1>When a homeowner asks AI who to recommend, <em>are you the answer?</em></h1>
        <p className="lede">The first local AI visibility tool built for home service companies.</p>

        <a href="#signup" className="hero-cta">Request my free report <Arrow /></a>

        <div className="bento" aria-hidden="true">
          {/* AI visibility score */}
          <div className="bcard b-vis">
            <div className="blab"><span>AI visibility score</span></div>
            <div className="glegend">
              <span><i className="lo" />Low</span>
              <span><i className="md" />Medium</span>
              <span><i className="hi" />High</span>
            </div>
            <div className="gauge-wrap">
              <Gauge value={55} />
              <div className="gauge-center">
                <strong>55%</strong>
                <span className="pill">High</span>
              </div>
            </div>
            <div className="cap">Across 50 tracked prompts</div>
            <div className="surf">
              <div className="row"><span>Gemini</span><div className="track-sm"><i style={{ width: "79%" }} /></div><b>79%</b></div>
              <div className="row"><span>ChatGPT</span><div className="track-sm"><i style={{ width: "32%" }} /></div><b>32%</b></div>
            </div>
          </div>

          {/* Sentiment score */}
          <div className="bcard b-sent">
            <div className="blab"><span>AI sentiment</span></div>
            <div className="sval"><strong>+0.59</strong><em>Positive</em></div>
            <div className="meter"><i style={{ left: "79.5%" }} /></div>
            <div className="scale"><span>−1</span><span>0</span><span>+1</span></div>
          </div>

          {/* Top citation sources */}
          <div className="bcard b-cit">
            <div className="blab"><span>Top citation sources</span></div>
            <div className="clist">
              {CITES.map((c) => (
                <div key={c.domain} className={"crow" + (c.owned ? " you" : "")}>
                  <span className="dn">
                    <span>{c.domain}</span>
                    {c.owned ? <span className="own">You</span> : null}
                  </span>
                  <b>{c.count}</b>
                </div>
              ))}
            </div>
          </div>

          {/* Competitor visibility ranking */}
          <div className="bcard b-rank">
            <div className="blab"><span>Competitor visibility ranking</span><span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500, color: "var(--fg-placeholder)" }}>Your market</span></div>
            {RANK.map((r) => (
              <div key={r.rk} className={"rrow" + (r.you ? " you" : "")}>
                <span className="rk">{r.rk}</span>
                <span className="nm">{r.nm}</span>
                <div className="track-sm"><i style={{ width: r.v + "%", background: r.you ? "var(--primary)" : "var(--border-strong)" }} /></div>
                <span className="vv">{r.v}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Signup flow (left) ── */
function Signup() {
  const [isClient, setIsClient] = useState<"" | "yes" | "no">("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [company, setCompany] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [size, setSize] = useState<string>("");
  const [industry, setIndustry] = useState<string>("");
  const [serviceArea, setServiceArea] = useState<string>("");
  const [touched, setTouched] = useState<boolean>(false);
  const [view, setView] = useState<"form" | "ok" | "wait">("form");

  const reset = () => {
    setView("form"); setIsClient(""); setFirstName(""); setLastName(""); setCompany(""); setEmail(""); setSize(""); setIndustry(""); setServiceArea(""); setTouched(false);
  };
  const nameOk = firstName.trim() !== "" && lastName.trim() !== "";

  const submit = () => {
    setTouched(true);
    if (isClient === "yes") {
      if (!nameOk || !emailOk(email)) return;
      setView("ok");
      return;
    }
    if (isClient === "no") {
      if (!nameOk || !company.trim() || !emailOk(email) || !size) return;
      setView(size === "<15M" ? "wait" : "ok");
    }
  };

  /* ── Result screens ── */
  if (view === "ok") {
    return (
      <div className="signup">
        <div className="signup-inner">
          <div className="s-brand"><img src={WORDMARK_GREEN} alt="Netic" /></div>
          <div className="result ok">
            <div className="mark"><Check /></div>
            <h2>You&apos;re on the list.</h2>
            <p>
              We&apos;ve received your request and we&apos;ll email your access link the moment your report is ready.
              Running every query takes a couple of days, so hang tight while we put your numbers together.
            </p>
            <div className="recap">
              {isClient === "no" && company.trim() ?
                <div className="rr"><span>Company</span><b>{company.trim()}</b></div> :
                null}
              {serviceArea.trim() ?
                <div className="rr"><span>Service area</span><b>{serviceArea.trim()}</b></div> :
                null}
              <div className="rr"><span>Access link to</span><b>{email.trim()}</b></div>
            </div>
            <button className="backlink" onClick={reset}><Back />Submit another company</button>
          </div>
        </div>
        <div className="signup-foot">Questions? Reach your Netic contact or email pilot@netic.ai.</div>
      </div>
    );
  }

  if (view === "wait") {
    return (
      <div className="signup">
        <div className="signup-inner">
          <div className="s-brand"><img src={WORDMARK_GREEN} alt="Netic" /></div>
          <div className="result wait">
            <div className="mark"><Clock /></div>
            <h2>We&apos;ve saved your spot.</h2>
            <p>
              Thanks for your interest! Due to high demand, we&apos;ve added you to the waitlist and we&apos;ll
              reach out the moment we open it up to more companies.
            </p>
            <div className="recap">
              <div className="rr"><span>Company</span><b>{company.trim()}</b></div>
              <div className="rr"><span>Email</span><b>{email.trim()}</b></div>
            </div>
            <button className="backlink" onClick={reset}><Back />Submit another company</button>
          </div>
        </div>
        <div className="signup-foot">Questions? Reach your Netic contact or email pilot@netic.ai.</div>
      </div>
    );
  }

  /* ── Form ── */
  const showDetails = isClient === "no";
  const stepTwo = isClient !== "";

  return (
    <div className="signup" id="signup">
      <div className="signup-inner">
        <div className="s-brand"><img src={WORDMARK_GREEN} alt="Netic" /></div>
        <h1 className="s-head">Request your AI visibility deep dive</h1>
        <p className="s-sub">A dashboard of how your company ranks across Google Gemini and ChatGPT.</p>

        <ul className="whatsin">
          <li><Check /><span>Check hundreds of AI queries at local level</span></li>
          <li><Check /><span>See which prompts and sources drive local AI rank</span></li>
          <li><Check /><span>Compare your rank against local competitors</span></li>
        </ul>

        <div className="steps">
          <span className="step-label">Step {stepTwo ? 2 : 1} of 2</span>
          <div className="step-bars">
            <i className="on" />
            <i className={stepTwo ? "on" : ""} />
          </div>
        </div>

        <div className="fld">
          <label>Are you a current Netic client?</label>
          <div className={"seg-row" + (touched && !isClient ? " err" : "")} role="radiogroup" aria-label="Are you a current Netic client?">
            <button type="button" className={"seg" + (isClient === "yes" ? " sel" : "")}
              role="radio" aria-checked={isClient === "yes"}
              onClick={() => { setIsClient("yes"); setTouched(false); }}>Yes</button>
            <button type="button" className={"seg" + (isClient === "no" ? " sel" : "")}
              role="radio" aria-checked={isClient === "no"}
              onClick={() => { setIsClient("no"); setTouched(false); }}>Not yet</button>
          </div>
        </div>

        {stepTwo ?
          <div className="fld-row">
            <div className="fld">
              <label htmlFor="fn">First name<span className="req">*</span></label>
              <input id="fn" type="text" placeholder="Jane" value={firstName}
                className={touched && !firstName.trim() ? "err" : ""}
                onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="fld">
              <label htmlFor="ln">Last name<span className="req">*</span></label>
              <input id="ln" type="text" placeholder="Doe" value={lastName}
                className={touched && !lastName.trim() ? "err" : ""}
                onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div> :
          null}

        {isClient === "yes" ?
          <div className="fld">
            <label htmlFor="email-y">Company email<span className="req">*</span></label>
            <input id="email-y" type="email" placeholder="you@company.com" value={email}
              className={touched && !emailOk(email) ? "err" : ""}
              onChange={(e) => setEmail(e.target.value)} />
          </div> :
          null}

        {showDetails ?
          <>
            <div className="fld-row">
              <div className="fld">
                <label htmlFor="company">Company name<span className="req">*</span></label>
                <input id="company" type="text" placeholder="e.g. AllTech Services" value={company}
                  className={touched && !company.trim() ? "err" : ""}
                  onChange={(e) => setCompany(e.target.value)} />
              </div>
              <div className="fld">
                <label htmlFor="email-n">Company email<span className="req">*</span></label>
                <input id="email-n" type="email" placeholder="you@company.com" value={email}
                  className={touched && !emailOk(email) ? "err" : ""}
                  onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="fld-row">
              <div className="fld">
                <label htmlFor="rev">Annual revenue<span className="req">*</span></label>
                <select id="rev" value={size} className={touched && !size ? "err" : ""} onChange={(e) => setSize(e.target.value)}>
                  <option value="">Select one…</option>
                  {REVENUE.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              <div className="fld">
                <label htmlFor="ind">Industry</label>
                <select id="ind" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                  <option value="">Select one…</option>
                  {INDUSTRY.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
          </> :
          null}

        {stepTwo ?
          <div className="fld">
            <label htmlFor="area">Primary service area <span className="opt">optional</span></label>
            <input id="area" type="text" placeholder="e.g. Cleveland, OH" value={serviceArea}
              onChange={(e) => setServiceArea(e.target.value)} />
            <span className="fld-hint">The #1 city your customers are in — not necessarily where your office is.</span>
          </div> :
          null}

        {touched && stepTwo && (!nameOk || !emailOk(email) || (showDetails && (!company.trim() || !size))) ?
          <span className="msg-err" style={{ display: "block", marginTop: -8, marginBottom: 16 }}>Please complete the required fields with a valid email.</span> :
          null}

        {stepTwo ?
          <button className="submit" onClick={submit}>
            Request my report <Arrow />
          </button> :
          null}
      </div>
    </div>
  );
}

function LandingApp() {
  return (
    <div className="land">
      <Signup />
      <Hero />
    </div>
  );
}

export default function PilotPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pilotStyles }} />
      <LandingApp />
    </>
  );
}
