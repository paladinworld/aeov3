"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { accessStyles } from "../access-styles";

const WORDMARK_GREEN = "/netic/netic-wordmark-green.svg";

const emailOk = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
  );
}
function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
  );
}

/* ── Brand hero (right) — generic demo collage, no real company data ── */
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
  const ticks = [{ v: 0, t: "0" }, { v: 25, t: "25" }, { v: 50, t: "50" }, { v: 75, t: "75" }, { v: 100, t: "100" }];
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

const CITES = [
  { domain: "houzz.com", count: 15, owned: false },
  { domain: "summitcomfort.com", count: 13, owned: true },
  { domain: "mapquest.com", count: 13, owned: false },
  { domain: "nextdoor.com", count: 12, owned: false }
];
const RANK = [
  { rk: 1, nm: "Brightway Heating & Air", v: 72 },
  { rk: 2, nm: "You", v: 55, you: true },
  { rk: 3, nm: "Northpoint Plumbing & HVAC", v: 49 },
  { rk: 4, nm: "Hearthside Heating & Cooling", v: 41 }
];

function Hero() {
  return (
    <div className="hero">
      <div className="hero-content">
        <h1>When a homeowner asks AI who to call, <em>do you show up?</em></h1>
        <div className="bento" aria-hidden="true">
          <div className="bcard b-vis">
            <div className="blab"><span>AI visibility score</span></div>
            <div className="glegend">
              <span><i className="lo" />Low</span>
              <span><i className="md" />Medium</span>
              <span><i className="hi" />High</span>
            </div>
            <div className="gauge-wrap">
              <Gauge value={55} />
              <div className="gauge-center"><strong>55%</strong><span className="pill">High</span></div>
            </div>
            <div className="cap">Across 40 tracked prompts</div>
            <div className="surf">
              <div className="row"><span>Gemini</span><div className="track-sm"><i style={{ width: "79%" }} /></div><b>79%</b></div>
              <div className="row"><span>ChatGPT</span><div className="track-sm"><i style={{ width: "32%" }} /></div><b>32%</b></div>
            </div>
          </div>
          <div className="bcard b-sent">
            <div className="blab"><span>AI sentiment</span></div>
            <div className="sval"><strong>+0.59</strong><em>Positive</em></div>
            <div className="meter"><i style={{ left: "79.5%" }} /></div>
            <div className="scale"><span>−1</span><span>0</span><span>+1</span></div>
          </div>
          <div className="bcard b-cit">
            <div className="blab"><span>Top citation sources</span></div>
            <div className="clist">
              {CITES.map((c) => (
                <div key={c.domain} className={"crow" + (c.owned ? " you" : "")}>
                  <span className="dn"><span>{c.domain}</span>{c.owned ? <span className="own">You</span> : null}</span>
                  <b>{c.count}</b>
                </div>
              ))}
            </div>
          </div>
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

/* ── Sign-in (left): email + access code ── */
function SignIn() {
  const params = useSearchParams();
  const reportId = params.get("report") || "";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const valid = emailOk(email) && code.trim() !== "";

  const submit = async () => {
    setTouched(true);
    setError("");
    if (!valid) return;
    setBusy(true);
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim(), reportId: reportId || undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "That email and access code don't match.");
        return;
      }
      window.location.href = data.redirect || "/";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signup" id="signin">
      <div className="signup-inner">
        <div className="s-brand"><img src={WORDMARK_GREEN} alt="Netic" /></div>
        <h1 className="s-head">View your AI visibility report</h1>
        <p className="s-sub">Enter the email and access code from your invitation to continue.</p>

        <ul className="whatsin">
          <li><Check /><span>See where AI recommends you across local prompts</span></li>
          <li><Check /><span>Tracked across Google Gemini and ChatGPT</span></li>
          <li><Check /><span>Compare your visibility against local competitors</span></li>
        </ul>

        <div className="fld">
          <label htmlFor="email">Email<span className="req">*</span></label>
          <input id="email" type="email" placeholder="you@company.com" value={email}
            autoComplete="email"
            className={touched && !emailOk(email) ? "err" : ""}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        </div>

        <div className="fld">
          <label htmlFor="code">Access code<span className="req">*</span></label>
          <input id="code" type="text" placeholder="Enter your access code" value={code}
            autoComplete="off"
            className={touched && !code.trim() ? "err" : ""}
            onChange={(e) => { setCode(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        </div>

        {error ? <span className="msg-err" style={{ display: "block", marginTop: -8, marginBottom: 16 }}>{error}</span> : null}

        <button className="submit" onClick={submit} disabled={busy}>
          {busy ? "Checking…" : <>View my report <Arrow /></>}
        </button>
      </div>
      <div className="signup-foot">Need access? Reach your Netic contact or email pilot@netic.ai.</div>
    </div>
  );
}

export default function AccessPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: accessStyles }} />
      <div className="land">
        <Suspense fallback={<div className="signup" />}>
          <SignIn />
        </Suspense>
        <Hero />
      </div>
    </>
  );
}
