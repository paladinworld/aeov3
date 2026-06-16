"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Guided onboarding tour (Spotlight / Option C per design handoff). Self-contained + flag-gated:
// anchors to live DOM via [data-tour="..."], dims the page with a single spotlight box-shadow,
// and walks Home -> Prompts -> Citations. Purely additive overlay; flip the flag off = no-op.

type Step = {
  view: string;
  sel: string; // matches data-tour="<sel>"
  title: string;
  body: string;
  expand?: boolean; // expand the first row/domain before anchoring (steps 5, 7)
};

const STEPS: Step[] = [
  { view: "home", sel: "insights", title: "Key insights & actions", body: "Start here — the headline takeaways on your visibility, and the exact actions to take next." },
  { view: "home", sel: "score", title: "Your AI visibility score", body: "How often AI recommends you overall — plus a breakdown by platform, since AI platforms can rank you very differently." },
  { view: "home", sel: "leaderboard", title: "How you stack up", body: "Your ranking against competitors — overall and on each AI platform." },
  { view: "prompts", sel: "nav-prompts", title: "Where you show up", body: "The kinds of questions you appear for. See where you’re strong and where there’s room to climb." },
  { view: "prompts", sel: "prompt-row", expand: true, title: "Go prompt by prompt", body: "Your rank for a single prompt on each AI platform — and the exact sources AI cited to decide it." },
  { view: "citations", sel: "nav-citations", title: "The sources behind the answers", body: "The top citation sources that AI quotes. Filter by platform and prompt intent." }
];

const KEY_DONE = "netic_aivt_tour_done";
const KEY_STEP = "netic_aivt_tour_step";
const PAD = 6; // spotlight padding around the target
const CARD_W = 430;

type Box = { l: number; t: number; w: number; h: number };

export default function OnboardingTour({ ready, view, setView }: { ready: boolean; view: string; setView: (v: string) => void }) {
  const [phase, setPhase] = useState<"idle" | "tour" | "fab">("idle");
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 768);
  const iRef = useRef(i);
  iRef.current = i;

  useEffect(() => {
    const mq = () => setMobile(window.innerWidth <= 768);
    mq();
    window.addEventListener("resize", mq);
    return () => window.removeEventListener("resize", mq);
  }, []);

  // Auto-start on first visit once data is ready; otherwise show the FAB launcher.
  useEffect(() => {
    if (!ready || phase !== "idle" || typeof window === "undefined") return;
    // The full tour auto-runs ONCE (first desktop visit). After that, return visits keep the
    // floating ? help FAB available (so help is always one click away) — they just don't
    // re-pop the walkthrough.
    if (localStorage.getItem(KEY_DONE) === "1") { setPhase("fab"); return; }
    if (mobile) { localStorage.setItem(KEY_DONE, "1"); setPhase("fab"); return; } // desktop-only tour; mobile gets the FAB once
    const saved = parseInt(localStorage.getItem(KEY_STEP) || "0", 10);
    setI(Number.isNaN(saved) ? 0 : Math.min(Math.max(saved, 0), STEPS.length - 1));
    setPhase("tour");
  }, [ready, phase, mobile]);

  const finish = useCallback(() => {
    if (typeof window !== "undefined") localStorage.setItem(KEY_DONE, "1");
    setPhase("fab");
    setBox(null);
    setHint(true);
    window.setTimeout(() => setHint(false), 3200);
  }, []);

  // On each step: navigate to its tab, expand if needed, wait for the target to mount, anchor.
  useEffect(() => {
    if (phase !== "tour") return;
    const step = STEPS[i];
    if (view !== step.view) setView(step.view);
    let raf = 0;
    let tries = 0;
    const tick = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.sel}"]`);
      if (el) {
        if (step.expand && el.dataset.tourExpanded !== "1") {
          (el.querySelector<HTMLElement>("[data-tour-expand]") || el).click();
          el.dataset.tourExpanded = "1";
        }
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        if (typeof window !== "undefined") localStorage.setItem(KEY_STEP, String(i));
        // let the smooth scroll settle, then measure
        window.setTimeout(() => {
          const r = el.getBoundingClientRect();
          setBox({ l: r.left, t: r.top, w: r.width, h: r.height });
        }, 320);
        return;
      }
      if (++tries < 150) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, i, view, setView]);

  // Keep the spotlight glued to the target on scroll/resize.
  useEffect(() => {
    if (phase !== "tour") return;
    const reposition = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${STEPS[iRef.current].sel}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        setBox({ l: r.left, t: r.top, w: r.width, h: r.height });
      }
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [phase]);

  // Keyboard: arrows navigate, Esc closes.
  useEffect(() => {
    if (phase !== "tour") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((x) => (x < STEPS.length - 1 ? x + 1 : (finish(), x)));
      else if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
      else if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, finish]);

  // Lock USER scrolling during the walkthrough so the page doesn't drift behind the
  // overlay. We swallow wheel/touch/scroll-key input but leave programmatic scrolling
  // alone, so the tour's own scrollIntoView() still brings each step's target into view.
  useEffect(() => {
    if (phase !== "tour") return;
    const SCROLL_KEYS = new Set([" ", "PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"]);
    const stop = (e: Event) => e.preventDefault();
    const onScrollKey = (e: KeyboardEvent) => { if (SCROLL_KEYS.has(e.key)) e.preventDefault(); };
    window.addEventListener("wheel", stop, { passive: false });
    window.addEventListener("touchmove", stop, { passive: false });
    window.addEventListener("keydown", onScrollKey, { passive: false });
    return () => {
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchmove", stop);
      window.removeEventListener("keydown", onScrollKey);
    };
  }, [phase]);

  // If the viewport shrinks to mobile mid-tour, drop the walkthrough (mobile = FAB only).
  useEffect(() => {
    if (mobile && phase === "tour") setPhase("fab");
  }, [mobile, phase]);

  // Close the help menu on tab navigation, outside-click, or Esc.
  useEffect(() => { setMenuOpen(false); }, [view]);
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".tour-launcher")) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  if (phase === "idle" || typeof document === "undefined") return null;

  const last = i === STEPS.length - 1;
  // Completing the walkthrough ("Done" on the last step) returns to the Home view — the
  // last step lands on Citations, so without this you'd be left there. Dismissing via X/Esc
  // leaves you wherever you are.
  const next = () => {
    if (last) {
      setView("home");
      finish();
    } else setI(i + 1);
  };
  const back = () => setI(Math.max(0, i - 1));
  const restart = () => { setMenuOpen(false); setHint(false); setI(0); setPhase("tour"); };

  // Card placement: below the target if there's room, else above. Mobile = bottom sheet.
  let cardStyle: React.CSSProperties = {};
  let caretStyle: React.CSSProperties | null = null;
  if (box && !mobile && phase === "tour") {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    if (box.l + box.w < 260) {
      // left-nav target (steps 4 & 6) -> card to the RIGHT, caret pointing left
      const left = box.l + box.w + PAD + 16;
      const top = Math.min(Math.max(box.t - 6, 14), vh - 240);
      cardStyle = { left, top, width: CARD_W };
      const caretY = Math.min(Math.max(box.t + box.h / 2 - top, 22), 210);
      caretStyle = { left: -8, top: caretY - 8, borderLeft: "1px solid rgba(255,255,255,0.1)", borderBottom: "1px solid rgba(255,255,255,0.1)" };
    } else {
      const below = box.t + box.h + 360 < vh;
      const left = Math.min(Math.max(box.l, 14), vw - CARD_W - 14);
      const top = below ? box.t + box.h + PAD + 14 : Math.max(14, box.t - PAD - 14 - 240);
      cardStyle = { left, top, width: CARD_W };
      const caretX = Math.min(Math.max(box.l + box.w / 2 - left, 24), CARD_W - 24);
      caretStyle = below
        ? { left: caretX - 8, top: -8, borderLeft: "1px solid rgba(255,255,255,0.1)", borderTop: "1px solid rgba(255,255,255,0.1)" }
        : { left: caretX - 8, bottom: -8, borderRight: "1px solid rgba(255,255,255,0.1)", borderBottom: "1px solid rgba(255,255,255,0.1)" };
    }
  }

  return createPortal(
    <>
      <style>{TOUR_CSS}</style>

      {phase === "tour" && box && !mobile ? (
        <div className="tour-layer" role="dialog" aria-modal="true" aria-label="Product tour">
          <div className="tour-spot" style={{ left: box.l - PAD, top: box.t - PAD, width: box.w + PAD * 2, height: box.h + PAD * 2 }} />
          <div className={"tour-card" + (mobile ? " sheet" : "")} style={cardStyle}>
            {!mobile && caretStyle ? <div className="tour-caret" style={caretStyle} /> : null}
            {mobile ? <div className="tour-grab" /> : null}
            <div className="tour-top">
              <span className="tour-steplbl">Step {i + 1} of {STEPS.length}</span>
              <button className="tour-x" aria-label="Close tour" onClick={finish}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,253,245,0.55)" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <h3 className="tour-title">{STEPS[i].title}</h3>
            <p className="tour-body">{STEPS[i].body}</p>
            <div className="tour-foot">
              <div className="tour-dots">
                {STEPS.map((_, k) => <span key={k} className={"tour-dot" + (k === i ? " on" : "")} />)}
              </div>
              <div className="tour-nav">
                <button className="tour-back" onClick={back} disabled={i === 0}>Back</button>
                <button className="tour-next" onClick={next}>
                  {last ? "Done" : "Next"}
                  {last ? null : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--netic-green-ink, #173F33)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "fab" ? (
        <div className="tour-launcher">
          {hint ? <div className="tour-fabhint">Restart the tour anytime here</div> : null}
          {menuOpen ? (
            <div className="tour-menu">
              {!mobile ? (
                <>
                  <button className="tour-mi" onClick={restart}>
                    <span className="tour-mi-ico"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9 16.2 7.8" /></svg></span>
                    <span><span className="tour-mi-t">Restart product tour</span><span className="tour-mi-s">Replay the {STEPS.length}-step walkthrough</span></span>
                  </button>
                  <div className="tour-mdiv" />
                </>
              ) : null}
              <a className="tour-mi" href="mailto:shan@netic.ai?subject=Feedback%20on%20AI%20Visibility%20Tracker&body=%0D%0A%0D%0A%E2%80%94%20Sent%20from%20the%20AI%20Visibility%20Tracker" onClick={() => setMenuOpen(false)}>
                <span className="tour-mi-ico"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg></span>
                <span><span className="tour-mi-t">Send feedback</span><span className="tour-mi-s">Email shan@netic.ai</span></span>
              </a>
            </div>
          ) : null}
          <button className="tour-fab" aria-label="Help and feedback" onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); setHint(false); }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          </button>
        </div>
      ) : null}
    </>,
    document.body
  );
}

// Ported from the prototype, mapped to product tokens (--primary, --border, etc.) per the handoff.
const TOUR_CSS = `
.tour-layer{position:fixed;inset:0;z-index:1000;}
.tour-spot{position:fixed;border-radius:10px;box-shadow:0 0 0 9999px rgba(15,28,23,0.62);outline:2px solid color-mix(in srgb, var(--primary) 65%, white);outline-offset:0;z-index:1001;pointer-events:none;transition:left .42s cubic-bezier(.4,0,.2,1),top .42s cubic-bezier(.4,0,.2,1),width .42s cubic-bezier(.4,0,.2,1),height .42s cubic-bezier(.4,0,.2,1);}
.tour-caret{position:absolute;width:16px;height:16px;background:var(--netic-green-ink,#173F33);transform:rotate(45deg);}
.tour-card{position:fixed;background:var(--netic-green-ink,#173F33);border:1px solid rgba(255,255,255,0.1);border-radius:12px;box-shadow:0 22px 50px -14px rgba(0,0,0,0.55);padding:18px 20px 16px;z-index:1002;transition:left .42s cubic-bezier(.4,0,.2,1),top .42s cubic-bezier(.4,0,.2,1);}
.tour-card.sheet{left:0!important;right:0;top:auto!important;bottom:0;width:auto!important;border-radius:22px 22px 0 0;padding:10px 20px max(24px,env(safe-area-inset-bottom));animation:tourSheet .26s cubic-bezier(.4,0,.2,1);}
@keyframes tourSheet{from{transform:translateY(100%);}to{transform:none;}}
.tour-grab{width:36px;height:4px;border-radius:9999px;background:rgba(255,255,255,0.25);margin:2px auto 12px;}
.tour-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.tour-steplbl{font-size:10px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:color-mix(in srgb, var(--primary) 45%, white);}
.tour-x{background:none;border:none;padding:2px;cursor:pointer;line-height:0;border-radius:5px;}
.tour-x:hover{background:rgba(255,255,255,0.08);}
.tour-title{font-size:17px;font-weight:600;color:var(--netic-cream,#FFFDF5);margin:0 0 6px;letter-spacing:-0.01em;}
.tour-body{font-size:14px;line-height:1.55;color:rgba(255,253,245,0.7);margin:0;}
.tour-foot{display:flex;align-items:center;justify-content:space-between;margin-top:20px;}
.tour-dots{display:flex;align-items:center;gap:6px;}
.tour-dot{width:6px;height:6px;border-radius:9999px;background:rgba(255,255,255,0.22);flex:none;transition:width .3s,background .3s;}
.tour-dot.on{width:18px;background:color-mix(in srgb, var(--primary) 65%, white);}
.tour-nav{display:flex;align-items:center;gap:10px;}
.tour-back{background:none;border:none;font-family:inherit;font-size:14px;font-weight:500;color:rgba(255,253,245,0.45);cursor:pointer;padding:8px 4px;}
.tour-back:hover:not(:disabled){color:rgba(255,253,245,0.8);}
.tour-back:disabled{opacity:0.35;cursor:default;}
.tour-next{background:var(--netic-cream,#FFFDF5);border:none;font-family:inherit;color:var(--netic-green-ink,#173F33);font-size:14px;font-weight:600;padding:9px 18px;border-radius:7px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
.tour-next:hover{box-shadow:0 4px 14px rgba(0,0,0,0.25);}
.tour-launcher{position:fixed;right:26px;bottom:26px;z-index:1000;}
.tour-fab{width:52px;height:52px;border-radius:9999px;background:var(--primary,#137A4A);border:none;cursor:pointer;box-shadow:0 12px 26px -6px rgba(19,122,74,0.55);display:flex;align-items:center;justify-content:center;transition:transform .15s,box-shadow .2s;}
.tour-fab:hover{transform:translateY(-2px);}
.tour-menu{position:absolute;right:0;bottom:64px;width:272px;background:var(--bg,#fff);border:1px solid var(--border,#E3E5E7);border-radius:12px;box-shadow:0 18px 44px -12px rgba(0,0,0,0.3);padding:6px;animation:tourMenu .16s ease;}
@keyframes tourMenu{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;transform:none;}}
.tour-mi{display:flex;gap:11px;align-items:flex-start;padding:9px 10px;border-radius:8px;text-decoration:none;cursor:pointer;border:none;background:none;width:100%;text-align:left;font-family:inherit;}
.tour-mi:hover{background:var(--bg-muted,#F3F6F4);}
.tour-mi-ico{width:32px;height:32px;border-radius:7px;background:color-mix(in srgb, var(--primary) 12%, white);color:var(--primary,#137A4A);display:flex;align-items:center;justify-content:center;flex:none;}
.tour-mi-t{font-size:13.5px;font-weight:600;color:var(--fg,#303030);display:block;}
.tour-mi-s{font-size:12px;color:var(--fg-muted,#737373);margin-top:1px;display:block;}
.tour-mdiv{height:1px;background:var(--border,#EFEFEF);margin:4px 8px;}
.tour-fabhint{position:absolute;right:64px;bottom:14px;white-space:nowrap;background:var(--netic-green-ink,#173F33);color:var(--netic-cream,#FFFDF5);font-size:12.5px;font-weight:500;padding:8px 12px;border-radius:8px;box-shadow:0 10px 24px -8px rgba(0,0,0,0.4);}
.tour-fabhint:after{content:"";position:absolute;right:-5px;top:50%;transform:translateY(-50%) rotate(45deg);width:10px;height:10px;background:var(--netic-green-ink,#173F33);}
@media (max-width:768px){.tour-launcher{bottom:84px;right:22px;}}
@media (prefers-reduced-motion: reduce){.tour-spot,.tour-card,.tour-card.sheet,.tour-menu{transition:none!important;animation:none!important;}}
`;
