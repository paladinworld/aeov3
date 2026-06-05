export const accessStyles = `
@import url("https://rsms.me/inter/inter.css");

:root {
  /* ── Brand ── */
  --netic-green:         hsl(147 73% 27%);
  --netic-green-hover:   hsl(147 73% 32%);
  --netic-green-deep:    hsl(147 75% 20%);
  --netic-green-ink:     hsl(162 41% 17%);
  --netic-cream:         hsl(48 100% 98%);

  /* ── Surfaces ── */
  --bg:           hsl(0 0% 100%);
  --bg-muted:     hsl(0 0% 97.3%);
  --bg-sidebar:   hsl(0 0% 98%);
  --surface-card: hsl(0 0% 96%);
  --surface-selected: hsl(0 0% 88%);

  /* ── Text ── */
  --fg:            hsl(0 0% 18.8%);
  --fg-caption:    hsl(0 0% 39.2%);
  --fg-muted:      hsl(0 0% 45.1%);
  --fg-placeholder:hsl(0 0% 63.1%);
  --fg-inverse:    hsl(0 0% 100%);

  /* ── Border / input ── */
  --border:       hsl(210 8% 90%);
  --border-strong:hsl(0 0% 82%);
  --input:        var(--border);
  --ring:         var(--netic-green-hover);

  /* ── Semantic ── */
  --primary:       var(--netic-green);
  --primary-hover: var(--netic-green-hover);
  --primary-fg:    hsl(0 0% 100%);

  --secondary:     hsl(0 0% 95.3%);
  --secondary-hover:hsl(0 0% 90%);
  --secondary-fg:  var(--fg);

  --accent:        hsl(212 56% 48.8%);
  --accent-hover:  hsl(212 56% 43%);
  --accent-fg:     hsl(0 0% 100%);

  --destructive:       hsl(0 73% 45%);
  --destructive-hover: hsl(0 73% 40%);
  --destructive-fg:    hsl(0 0% 100%);

  --success:       hsl(147 52% 41%);
  --success-hover: hsl(147 52% 46%);
  --success-fg:    hsl(0 0% 100%);

  --warning:       hsl(29 80% 55%);
  --warning-fg:    hsl(0 0% 100%);
  --warning-soft:  hsl(44 92% 92%);

  --information:   hsl(213 61% 47%);
  --information-50: hsl(210 60% 96%);
  --information-100:hsl(213 60% 90%);
  --information-500:hsl(213 61% 47%);

  /* ── Marketing green tints ── */
  --green-50:  #F9FFFB;
  --green-100: #F3F8F6;
  --green-200: #C4DDD1;
  --green-300: #A5BFA5;
  --green-400: #89BBA3;
  --green-500: #78B18E;
  --green-600: #699969;
  --green-700: #0F5B2C;
  --green-800: var(--netic-green-deep);
  --green-900: var(--netic-green-ink);

  /* ── Radii ── */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius:    0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;

  /* ── Shadows ── */
  --shadow-xs: 0 1px 2px 0 rgba(0,0,0,0.05);
  --shadow-sm: 0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.10), 0 4px 6px -4px rgba(0,0,0,0.05);
  --shadow-overlay: 0 20px 40px -8px rgba(0,0,0,0.20);

  /* ── Type ── */
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-display: "Inter", var(--font-sans);
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace;

  /* Transitions */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast: 120ms;
  --dur:      180ms;
  --dur-slow: 260ms;
}

/* ──────────────────────────────────────────────────────────────
   Netic AI Visibility — Pilot signup landing
   ──────────────────────────────────────────────────────────── */

*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--fg);font-family:var(--font-sans);-webkit-font-smoothing:antialiased}
button,input,select,textarea{font:inherit;color:inherit}
.tnum{font-variant-numeric:tabular-nums}

/* ── Page shell ── */
.land{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.04fr);min-height:100vh}

/* ── LEFT: form column ── */
.signup{display:flex;flex-direction:column;min-height:100vh;background:var(--bg)}
.signup-inner{flex:1;display:flex;flex-direction:column;justify-content:center;width:100%;max-width:520px;margin:0 auto;padding:56px 64px}
.signup-foot{padding:0 56px 28px;max-width:460px;width:100%;margin:0 auto;font-size:11px;color:var(--fg-placeholder);line-height:1.5}
.signup-foot a{color:var(--fg-muted)}

.s-brand{display:flex;align-items:center;gap:10px;margin-bottom:40px}
.s-brand img{height:22px;display:block}
.pilot-pill{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;background:color-mix(in oklab,var(--primary) 12%,transparent);color:var(--primary);padding:3px 8px;border-radius:var(--radius-full)}

.s-head{font-size:44px;font-weight:700;line-height:1.05;letter-spacing:-.03em;margin:0 0 16px;text-wrap:balance}
.s-sub{font-size:16px;color:var(--fg-caption);line-height:1.55;margin:0 0 24px;max-width:42ch}

/* what's inside list */
.whatsin{list-style:none;margin:0 0 32px;padding:0;display:flex;flex-direction:column;gap:12px}
.whatsin li{display:flex;align-items:flex-start;gap:11px;font-size:14px;line-height:1.4;color:var(--fg-caption)}
.whatsin li svg{width:18px;height:18px;flex:0 0 18px;margin-top:1px;color:var(--primary);stroke-width:2.4}

/* step progress dots */
.steps{margin-bottom:30px}
.step-label{display:block;font-size:11px;font-weight:600;color:var(--fg-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:9px}
.step-bars{display:flex;align-items:center;gap:7px}
.step-bars i{height:4px;border-radius:var(--radius-full);background:var(--secondary);flex:1;transition:background var(--dur) var(--ease-out)}
.step-bars i.on{background:var(--primary)}

/* fields */
.fld{display:flex;flex-direction:column;gap:8px;margin-bottom:22px}
.fld label{font-size:13px;font-weight:500;color:var(--fg)}
.fld .hint{font-size:11px;color:var(--fg-muted);font-weight:400}
.fld input,.fld select{appearance:none;width:100%;border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 14px;font-size:15px;font-weight:400;background:var(--bg);outline:none;transition:border-color var(--dur),box-shadow var(--dur)}
.fld select{padding-right:34px;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23646464' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 11px center}
.fld input::placeholder{color:var(--fg-placeholder)}
.fld input:focus,.fld select:focus{border-color:var(--primary-hover);box-shadow:0 0 0 3px color-mix(in oklab,var(--primary-hover) 18%,transparent)}
.fld input.err,.fld select.err{border-color:var(--destructive)}
.fld-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px}
.fld-row .fld{margin-bottom:0}
.req{color:var(--destructive);margin-left:2px;font-weight:600}
.opt{color:var(--fg-placeholder);margin-left:6px;font-weight:400;font-size:12px;text-transform:none;letter-spacing:0}
.fld-hint{display:block;font-size:12px;color:var(--fg-placeholder);margin-top:6px;line-height:1.4}
.fld .msg-err{font-size:11px;color:var(--destructive);font-weight:500}

/* submit */
.submit{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;border:1px solid var(--primary);border-radius:var(--radius-md);background:var(--primary);color:var(--primary-fg);padding:15px 16px;font-size:15px;font-weight:600;cursor:pointer;margin-top:8px;transition:background var(--dur),border-color var(--dur)}
.submit:hover{background:var(--primary-hover);border-color:var(--primary-hover)}
.start-cta{margin-top:8px;padding:18px 22px;font-size:16px;box-shadow:0 8px 22px color-mix(in oklab,var(--primary) 32%,transparent)}
.start-cta:hover{box-shadow:0 10px 26px color-mix(in oklab,var(--primary) 38%,transparent)}
.submit svg{width:16px;height:16px}
.backlink{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:var(--fg-muted);font-size:12px;font-weight:500;cursor:pointer;padding:14px 0 0;transition:color var(--dur)}
.backlink:hover{color:var(--fg)}
.backlink svg{width:14px;height:14px}

/* fieldset for revenue choices */
.field-group{margin-bottom:22px}
.field-group>span{display:block;font-size:13px;font-weight:500;color:var(--fg);margin-bottom:10px}
.radio-list{display:flex;flex-direction:column;gap:8px}
.radio-opt{display:flex;align-items:center;gap:11px;border:1px solid var(--border);border-radius:var(--radius-md);padding:13px 14px;cursor:pointer;transition:border-color var(--dur),background var(--dur)}
.radio-opt:hover{background:var(--bg-muted)}
.radio-opt.sel{border-color:var(--primary);background:color-mix(in oklab,var(--primary) 6%,transparent)}
.radio-opt .dot{flex:0 0 16px;width:16px;height:16px;border-radius:var(--radius-full);border:1.5px solid var(--border-strong);position:relative;transition:border-color var(--dur)}
.radio-opt.sel .dot{border-color:var(--primary)}
.radio-opt.sel .dot::after{content:"";position:absolute;inset:3px;border-radius:var(--radius-full);background:var(--primary)}
.radio-opt .lbl{font-size:15px;font-weight:500;white-space:nowrap}
.radio-opt .note{margin-left:auto;font-size:11px;color:var(--fg-muted)}

/* segmented toggle (client yes/no) */
.seg-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.seg{display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:var(--radius-md);padding:13px 14px;font-size:15px;font-weight:500;background:var(--bg);color:var(--fg);cursor:pointer;transition:border-color var(--dur),background var(--dur),color var(--dur)}
.seg:hover{background:var(--bg-muted)}
.seg.sel{border-color:var(--primary);background:color-mix(in oklab,var(--primary) 6%,transparent);color:var(--primary);font-weight:600}
.seg-row.err .seg{border-color:var(--destructive)}

/* confirmation / waitlist states */
.result{display:flex;flex-direction:column;gap:0;animation:rise .26s var(--ease-out) both}
.result .mark{width:52px;height:52px;border-radius:var(--radius-full);display:flex;align-items:center;justify-content:center;margin-bottom:20px}
.result .mark svg{width:26px;height:26px;stroke-width:2.4}
.result.ok .mark{background:color-mix(in oklab,var(--success) 14%,transparent);color:var(--success)}
.result.wait .mark{background:var(--warning-soft);color:#b56a1e}
.result h2{font-size:21px;font-weight:600;letter-spacing:-.01em;margin:0 0 10px;line-height:1.25}
.result p{font-size:14px;color:var(--fg-caption);line-height:1.6;margin:0 0 14px;max-width:42ch}
.result .recap{display:flex;flex-direction:column;gap:7px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-muted);padding:14px 16px;margin:6px 0 4px}
.result .recap .rr{display:flex;align-items:center;justify-content:space-between;gap:14px;font-size:13px}
.result .recap .rr span{color:var(--fg-muted)}
.result .recap .rr b{font-weight:600;color:var(--fg);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

/* ── RIGHT: ink-green brand hero ── */
.hero{position:sticky;top:0;align-self:start;height:100vh;background:var(--netic-green-ink);color:var(--netic-cream);display:flex;flex-direction:column;justify-content:center;padding:64px 64px 64px 60px;overflow:hidden}
.hero::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 100% 0%,color-mix(in oklab,var(--netic-green) 26%,transparent),transparent 60%);pointer-events:none}
.hero-content{position:relative;z-index:1;max-width:520px;width:100%;margin:0 auto}
.hero .over{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:color-mix(in oklab,var(--netic-cream) 64%,transparent);margin-bottom:18px}
.hero h1{font-size:38px;font-weight:600;line-height:1.12;letter-spacing:-.025em;margin:0 0 16px;text-wrap:balance}
.hero h1 em{font-style:normal;color:var(--green-400)}
.hero .lede{font-size:16px;line-height:1.55;color:color-mix(in oklab,var(--netic-cream) 88%,transparent);margin:0 0 8px;max-width:none;font-weight:500;text-wrap:balance}
@media(min-width:1200px){.hero .lede{white-space:nowrap}}
.hero .lede-src{font-size:13px;line-height:1.5;color:color-mix(in oklab,var(--netic-cream) 60%,transparent);margin:0 0 28px;max-width:42ch}

/* ── Bento collage ── */
.bento{display:grid;grid-template-columns:1fr 1fr;gap:12px;
  grid-template-areas:"vis sent" "vis cit" "rank rank"}
.bcard{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-overlay);padding:16px 16px 15px;color:var(--fg);display:flex;flex-direction:column;min-width:0}
.bcard .blab{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;font-weight:600;color:var(--fg-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px}
.bcard .blab .tag{font-size:9px;font-weight:600;letter-spacing:.04em;padding:2px 7px;border-radius:var(--radius-full);text-transform:uppercase}
.b-vis{grid-area:vis}
.b-sent{grid-area:sent}
.b-cit{grid-area:cit}
.b-rank{grid-area:rank}

/* visibility tile — gauge */
.glegend{display:flex;justify-content:space-between;gap:6px;margin:-2px 0 2px}
.glegend span{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:500;color:var(--fg-muted);white-space:nowrap}
.glegend i{width:8px;height:8px;border-radius:var(--radius-full);flex:0 0 auto}
.glegend i.lo{background:var(--destructive)}
.glegend i.md{background:var(--warning)}
.glegend i.hi{background:var(--success)}
.gauge-wrap{position:relative;margin:6px 0 2px}
.gauge-svg{display:block;width:100%;height:auto}
.gauge-svg .gtrack{fill:none;stroke:var(--secondary)}
.gauge-svg .gtick{fill:var(--fg-placeholder);font-size:9px;font-weight:600;font-variant-numeric:tabular-nums}
.gauge-svg .gneedle{fill:var(--fg)}
.gauge-center{position:absolute;left:50%;top:65%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:7px}
.gauge-center strong{font-size:30px;font-weight:700;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums;color:var(--fg)}
.gauge-center .pill{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding:3px 8px;border-radius:var(--radius-full);background:color-mix(in oklab,var(--success) 14%,transparent);color:var(--success)}
.b-vis .cap{font-size:12px;color:var(--fg-muted);margin:6px 0 0;text-align:center}
.b-vis .surf{display:flex;flex-direction:column;gap:11px;margin-top:auto;padding-top:18px}
.b-vis .surf .row{display:grid;grid-template-columns:60px 1fr 36px;align-items:center;gap:10px;font-size:12px}
.b-vis .surf .row span{font-weight:500}
.b-vis .surf .row b{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.track-sm{height:6px;background:var(--secondary);border-radius:var(--radius-full);overflow:hidden}
.track-sm i{display:block;height:100%;border-radius:var(--radius-full);background:var(--primary)}

/* sentiment tile */
.b-sent .sval{display:flex;align-items:baseline;gap:8px}
.b-sent .sval strong{font-size:38px;font-weight:600;letter-spacing:-.02em;line-height:1;color:var(--success);font-variant-numeric:tabular-nums}
.b-sent .sval em{font-style:normal;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--success);background:color-mix(in oklab,var(--success) 13%,transparent);padding:3px 8px;border-radius:var(--radius-full)}
.b-sent .meter{position:relative;height:6px;border-radius:var(--radius-full);margin-top:16px;background:linear-gradient(90deg,color-mix(in oklab,var(--destructive) 50%,white),var(--secondary) 50%,color-mix(in oklab,var(--success) 60%,white))}
.b-sent .meter i{position:absolute;top:50%;width:12px;height:12px;border-radius:var(--radius-full);background:var(--success);border:2px solid var(--bg);box-shadow:var(--shadow-sm);transform:translate(-50%,-50%)}
.b-sent .scale{display:flex;justify-content:space-between;margin-top:8px;font-size:10px;color:var(--fg-placeholder)}

/* citations tile */
.b-cit .clist{display:flex;flex-direction:column;gap:0;margin-top:-2px}
.b-cit .crow{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border);font-size:13px}
.b-cit .crow:first-child{border-top:0}
.b-cit .crow .dn{display:flex;align-items:center;gap:7px;min-width:0}
.b-cit .crow .dn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.b-cit .crow.you .dn span{color:var(--primary);font-weight:600}
.b-cit .crow .own{flex:0 0 auto;overflow:visible;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--primary);background:color-mix(in oklab,var(--primary) 12%,transparent);padding:1px 6px;border-radius:var(--radius-full)}
.b-cit .crow b{font-variant-numeric:tabular-nums;font-weight:600;color:var(--fg-muted);font-size:12px}

/* rank tile */
.b-rank .rrow{display:grid;grid-template-columns:18px 1fr 90px 44px;align-items:center;gap:12px;padding:9px 0;border-top:1px solid var(--border);font-size:13px}
.b-rank .rrow:first-of-type{border-top:0}
.b-rank .rrow.you{margin:0 -12px;padding:9px 12px;background:color-mix(in oklab,var(--primary) 6%,transparent);border-radius:var(--radius-md)}
.b-rank .rrow .rk{font-size:12px;font-weight:600;color:var(--fg-muted);font-variant-numeric:tabular-nums}
.b-rank .rrow .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.b-rank .rrow.you .nm{color:var(--primary);font-weight:600}
.b-rank .rrow .vv{text-align:right;font-weight:600;font-variant-numeric:tabular-nums}

/* CTA in the hero — only shown on mobile, where the hero sits above the form. */
.hero-cta{display:none;align-items:center;gap:8px;margin-top:24px;background:#fff;color:var(--primary);font-weight:600;font-size:15px;line-height:1;padding:15px 26px;border-radius:var(--radius-full);text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.22)}
.hero-cta:active{transform:translateY(1px)}
.hero-cta svg{width:16px;height:16px}

/* ── Responsive ── */
@media(max-width:1080px){
  .hero{padding:56px 48px}
  .signup-inner{padding:48px 44px}
}
@media(max-width:880px){
  .land{grid-template-columns:1fr}
  /* White form leads (logo + CTA upfront); GREEN brand panel follows below.
     Compact, top-aligned (no 100vh centering) so both sections fit early in scroll. */
  .signup{min-height:auto}
  .signup-inner{justify-content:flex-start;padding:24px 32px 44px;min-height:auto}
  .signup-foot{padding:0 32px 22px}
  /* position:relative (not static) keeps the ::before gradient INSIDE the green hero
     instead of escaping to the viewport top — green brand background retained. */
  .hero{position:relative;height:auto;min-height:auto;padding:46px 32px 40px}
  .hero h1{font-size:30px}
  .bento{margin-top:22px}
  /* On mobile, show only the visibility-score card, and keep the barometer compact */
  .b-sent,.b-cit,.b-rank{display:none}
  .b-vis{max-width:340px;margin-left:auto;margin-right:auto}
  .gauge-wrap{max-width:220px;margin-left:auto;margin-right:auto}
  #signup{scroll-margin-top:12px}
}
@media(max-width:620px){
  .bento{grid-template-columns:1fr;grid-template-areas:"vis" "sent" "cit" "rank"}
}
@media(max-width:560px){
  .signup-inner,.hero{padding-left:28px;padding-right:28px}
  .signup-foot{padding-left:28px;padding-right:28px}
  .s-head{font-size:34px}
  .hero h1{font-size:27px}
  .fld-row{grid-template-columns:1fr;gap:0;margin-bottom:0}
  .fld-row .fld{margin-bottom:22px}
}
`;
