/* ──────────────────────────────────────────────────────────────
   Netic AI Visibility (AEO V3) — dashboard styles
   Ported verbatim from the Claude design prototype (aeo/app.css),
   built on the Netic Official Design System tokens (globals.css).
   ──────────────────────────────────────────────────────────── */

export const dashboardStyles = `
*{box-sizing:border-box}
/* Global UI density — matches the Claude design-tool view (~90%). Tune to taste. */
.aeo3{zoom:0.9}
.aeo3 .app{min-height:calc(100vh / 0.9)}
button,input,select,textarea{font:inherit;color:inherit}
.aeo3 a{color:var(--primary);text-decoration:none}
.tnum{font-variant-numeric:tabular-nums}

/* ── App shell ── */
.app{display:flex;min-height:100vh}
.side{width:264px;flex:0 0 264px;background:var(--bg-sidebar);border-right:1px solid var(--border);display:flex;flex-direction:column;gap:2px;padding:22px 14px;position:sticky;top:0;height:100vh;overflow-y:auto}
.workspace{flex:1;min-width:0;background:var(--bg-muted);display:flex;flex-direction:column}

/* ── Brand ── */
.brand{display:flex;align-items:center;gap:9px;padding:4px 8px 14px}
.brand img{height:20px;display:block}
.beta-pill{font-size:9px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;background:color-mix(in oklab,var(--primary) 12%,transparent);color:var(--primary);padding:2px 6px;border-radius:var(--radius-full)}
.brand-sub{font-size:11px;color:var(--fg-muted);padding:0 8px 14px;margin-top:-8px;display:flex;align-items:center;gap:7px}

/* ── Account switcher ── */
.acct{padding:10px 10px 14px;margin:0 0 8px;border-bottom:1px solid var(--border)}
.acct-company{font-size:15px;font-weight:600;letter-spacing:-.01em;color:var(--fg);padding:0 2px 12px}
.acct label{display:block;font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.08em;color:var(--fg-muted);margin-bottom:6px}
.acct .sel{position:relative}
.acct select{width:100%;appearance:none;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-md);padding:8px 28px 8px 10px;font-size:13px;font-weight:500;cursor:pointer;outline:none}
.acct select:focus{border-color:var(--primary-hover);box-shadow:0 0 0 2px color-mix(in oklab,var(--primary-hover) 22%,transparent)}
.acct .sel svg{position:absolute;right:9px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--fg-muted);pointer-events:none}
.acct .loc{display:block;font-size:11px;color:var(--fg-muted);margin-top:7px;padding-left:2px}

/* ── Nav ── */
.nav-group{display:flex;flex-direction:column;gap:1px;margin-bottom:4px}
.nav-group>span{font-size:10px;font-weight:500;color:var(--fg-muted);text-transform:uppercase;letter-spacing:.08em;padding:14px 10px 6px}
.navi{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-md);font-size:13px;color:var(--fg);cursor:pointer;border:0;background:none;text-align:left;width:100%;transition:background var(--dur),color var(--dur)}
.navi:hover:not(:disabled){background:var(--bg-muted)}
.navi.active{background:color-mix(in oklab,var(--primary) 10%,transparent);color:var(--primary);font-weight:500}
.navi:disabled{opacity:.45;cursor:not-allowed}
.navi svg{width:16px;height:16px;flex:0 0 16px}
.navi span:first-of-type{flex:1}
.navi .count{font-size:11px;color:var(--fg-muted);font-variant-numeric:tabular-nums}
.navi.active .count{color:var(--primary)}
.navi .soon{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--fg-muted);background:var(--secondary);padding:2px 5px;border-radius:var(--radius-full)}
.side-foot{margin-top:auto;padding-top:14px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px}
.side-foot .av{width:28px;height:28px;border-radius:var(--radius-full);background:var(--primary);color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center}
.side-foot .nm{font-size:12px;font-weight:500;line-height:1.3}
.side-foot .rl{font-size:11px;color:var(--fg-muted)}

/* ── Top bar ── */
.topbar{display:flex;align-items:center;gap:16px;padding:0;height:60px;background:var(--bg);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:20}
.topbar-inner{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;max-width:1240px;margin:0 auto;padding:0 32px}
.crumb{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--fg-muted)}
.crumb svg{width:13px;height:13px;color:var(--fg-placeholder)}
.crumb b{color:var(--fg);font-weight:600}
.top-actions{display:flex;align-items:center;gap:10px}
.last-run{font-size:12px;color:var(--fg-muted);display:flex;align-items:center;gap:10px}
.access-left{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--primary);background:rgba(19,122,74,.08);border:1px solid rgba(19,122,74,.18);padding:3px 9px;border-radius:999px;white-space:nowrap}
.access-left.soon{color:#9a6a00;background:rgba(176,122,0,.10);border-color:rgba(176,122,0,.22)}
.access-left.expired{color:#b42318;background:rgba(180,35,24,.08);border-color:rgba(180,35,24,.20)}
.share-tools{display:flex;align-items:center;gap:6px}
.btn{display:inline-flex;align-items:center;gap:6px;border-radius:var(--radius-md);padding:7px 12px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:var(--bg);color:var(--fg);transition:background var(--dur),border-color var(--dur)}
.btn:hover{background:var(--bg-muted)}
.btn svg{width:13px;height:13px}
.btn.primary{background:var(--primary);border-color:var(--primary);color:var(--primary-fg)}
.btn.primary:hover{background:var(--primary-hover)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.share-wrap{position:relative}
.share-menu{position:absolute;top:calc(100% + 6px);right:0;z-index:50;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:var(--shadow-md);padding:4px;display:flex;flex-direction:column;min-width:168px}
.share-menu button{display:flex;align-items:center;gap:9px;border:0;background:none;padding:9px 10px;font-size:13px;font-weight:500;color:var(--fg);cursor:pointer;border-radius:var(--radius-sm);text-align:left;width:100%}
.share-menu button:hover{background:var(--bg-muted)}
.share-menu button svg{width:14px;height:14px;color:var(--fg-muted);flex:0 0 14px}

/* ── Main scroll body ── */
.main{padding:28px 32px 56px;max-width:1240px;width:100%;margin:0 auto}
.page-note{font-size:14px;color:var(--fg-caption);margin:0 0 6px;max-width:760px;line-height:var(--lh-normal)}
.cit-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cit-note{font-size:12.5px;color:var(--fg-caption);background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--radius-md);padding:9px 12px;margin:0;max-width:760px;line-height:1.5}
.bench-note{font-size:12px;color:var(--fg-muted);margin:0 0 22px;line-height:1.5;max-width:760px}
.view-stack{display:flex;flex-direction:column;gap:16px}

/* ── Metric grid + cards ── */
.metric-grid{display:grid;gap:12px}
.metric-grid.five{grid-template-columns:repeat(5,minmax(0,1fr))}
.metric-grid.four{grid-template-columns:repeat(4,minmax(0,1fr))}
.metric-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
.metric-2x2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;grid-auto-rows:1fr}
.metric-2x2 .metric-card{justify-content:center}
.metric-card{border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);padding:16px 18px;display:flex;flex-direction:column;gap:0;min-height:120px}
.metric-label{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--fg-muted)}
.info-dot{position:relative;display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:var(--radius-full);border:1px solid var(--border-strong);color:var(--fg-placeholder);font-size:9px;font-style:normal;cursor:help;flex:0 0 14px}
.info-dot em{visibility:hidden;opacity:0;position:absolute;bottom:calc(100% + 7px);left:50%;transform:translateX(-50%);background:var(--fg);color:#fff;padding:7px 10px;border-radius:var(--radius-md);font-size:11px;font-style:normal;font-weight:400;line-height:1.45;width:230px;box-shadow:var(--shadow-md);z-index:40;transition:opacity var(--dur);pointer-events:none}
.info-dot:hover em,.info-dot:focus em{visibility:visible;opacity:1}
.metric-value{display:flex;align-items:center;gap:9px;margin-top:12px}
.metric-value strong{font-size:30px;font-weight:600;line-height:1;letter-spacing:-.02em;color:var(--fg);font-variant-numeric:tabular-nums}
.metric-value strong.sm{font-size:18px;letter-spacing:-.01em}
.metric-card small{font-size:12px;color:var(--fg-muted);margin-top:10px}
.status-pill{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding:3px 8px;border-radius:var(--radius-full)}
.status-pill.high{background:color-mix(in oklab,var(--success) 12%,transparent);color:var(--success)}
.status-pill.medium{background:color-mix(in oklab,var(--warning) 16%,transparent);color:#b56a1e}
.status-pill.low{background:color-mix(in oklab,var(--destructive) 10%,transparent);color:var(--destructive)}
.status-pill.na{background:var(--secondary);color:var(--fg-muted)}

/* surface mini list inside metric card */
.surface-mini{display:flex;flex-direction:column;gap:10px;margin-top:12px}
.surface-mini-row{display:grid;grid-template-columns:64px 1fr 34px;align-items:center;gap:8px;font-size:12px}
.surface-mini-row span{color:var(--fg);font-weight:500}
.surface-mini-row b{text-align:right;font-variant-numeric:tabular-nums;color:var(--fg);font-weight:600}
.track{height:6px;background:var(--secondary);border-radius:var(--radius-full);overflow:hidden}
.track i{display:block;height:100%;background:var(--primary);border-radius:var(--radius-full)}
.track.high i{background:var(--success)}
.track.medium i{background:var(--warning)}
.track.low i{background:var(--destructive)}

/* ── Panels ── */
.dashboard-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.panel{border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);overflow:hidden}
.wide-panel{grid-column:1/-1}
.panel-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 20px;border-bottom:1px solid var(--border)}
.panel-head h2{font-size:15px;font-weight:600;margin:0;letter-spacing:-.01em}
.panel-head h2 .info-dot,.controls-head h2 .info-dot{margin-left:7px;vertical-align:middle}
.panel-head .info-dot em,.controls-head .info-dot em{bottom:auto;top:calc(100% + 7px)}
.panel-head .sub{font-size:12px;color:var(--fg-muted)}
.panel-body{padding:18px 20px}

/* ── Barometer (gauge) ── */
.hero-score{display:grid;grid-template-columns:300px 1fr;gap:40px;align-items:center;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);padding:28px 32px;margin-bottom:20px}
.hero-gauge{display:flex;flex-direction:column}
.hero-readout{display:flex;flex-direction:column}
.hero-readout .eyebrow{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--primary);margin-bottom:9px}
.hero-readout h2{font-size:22px;font-weight:600;letter-spacing:-.02em;margin:0 0 12px;line-height:1.2}
.hero-sentence{font-size:15px;line-height:1.6;color:var(--fg-caption);margin:0 0 14px;max-width:56ch}
.hero-sentence b{color:var(--fg);font-weight:600}
.hero-foot{font-size:12px;color:var(--fg-muted);margin:0}
.hero-platforms{display:flex;flex-direction:column;gap:9px;max-width:400px;margin:2px 0 16px}
.hero-platforms .hp-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-muted);margin-bottom:1px}
.hp-row{display:grid;grid-template-columns:64px 1fr 42px;align-items:center;gap:11px;font-size:13px}
.hp-row .hp-name{font-weight:500;color:var(--fg)}
.hp-row b{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:var(--fg)}
.section-label{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-muted);margin:0 0 10px}
.barometer-panel .panel-body{display:flex;flex-direction:column;justify-content:center}
.glegend{display:flex;justify-content:center;gap:20px;margin:0 0 4px}
.glegend span{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:500;color:var(--fg-muted);white-space:nowrap}
.glegend i{width:9px;height:9px;border-radius:var(--radius-full);flex:0 0 auto}
.glegend i.lo{background:var(--destructive)}
.glegend i.md{background:var(--warning)}
.glegend i.hi{background:var(--success)}
.gauge-wrap{position:relative;width:100%;max-width:320px;margin:0 auto}
.gauge-svg{display:block;width:100%;height:auto}
.gauge-svg .gtrack{fill:none;stroke:var(--secondary)}
.gauge-svg .gtick{fill:var(--fg-placeholder);font-size:9px;font-weight:600;font-variant-numeric:tabular-nums}
.gauge-svg .gneedle{fill:var(--fg)}
.gauge-center{position:absolute;left:50%;top:64%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:9px}
.gauge-center strong{font-size:40px;font-weight:700;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums;color:var(--fg)}
.gpill{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding:3px 9px;border-radius:var(--radius-full)}
.gpill.low{background:color-mix(in oklab,var(--destructive) 12%,transparent);color:var(--destructive)}
.gpill.medium{background:var(--warning-soft);color:#b56a1e}
.gpill.high{background:color-mix(in oklab,var(--success) 14%,transparent);color:var(--success)}
.gauge-cap{text-align:center;font-size:12px;color:var(--fg-muted);margin:14px 0 0}
.bm-platforms{display:flex;flex-direction:column;gap:13px;margin-top:22px;padding-top:18px;border-top:1px solid var(--border)}
.bm-prow{display:grid;grid-template-columns:72px 1fr 46px;align-items:center;gap:12px}
.bm-prow .bm-name{font-size:14px;font-weight:600;color:var(--fg)}
.bm-prow .platform-track{height:10px}
.bm-prow b{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;font-size:15px;color:var(--fg)}

/* by-platform card (hero right) */
.platform-panel .panel-body{display:flex;flex-direction:column;justify-content:center;height:100%}
.pf-list{display:flex;flex-direction:column;gap:26px}
.pf-row{display:flex;flex-direction:column;gap:11px}
.pf-name{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:600;color:var(--fg)}
.pf-ic{width:24px;height:24px;border-radius:var(--radius-md);background:var(--green-100);color:var(--primary);font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-style:normal;flex:0 0 auto}
.pf-bar{display:flex;align-items:center;gap:14px}
.pf-bar .platform-track{flex:1;height:12px}
.pf-bar b{font-variant-numeric:tabular-nums;font-weight:700;font-size:14px;color:var(--fg-muted);min-width:44px;text-align:right}

/* Key insights card */
.insights-panel .panel-body{display:flex;flex-direction:column;gap:18px;justify-content:center;height:100%}
.insight-lead{font-size:15px;line-height:1.6;color:var(--fg);margin:0}
.insight-lead b{font-weight:600}
.insight-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px}
.insight-list li{font-size:13px;line-height:1.55;color:var(--fg-caption);padding-left:16px;position:relative}
.insight-list li::before{content:"";position:absolute;left:0;top:7px;width:6px;height:6px;border-radius:var(--radius-full);background:var(--primary)}
.ins-k{font-weight:600;color:var(--fg)}
.ins-k::after{content:":"}

/* horizontal AI visibility score section */
.score-body{display:grid;grid-template-columns:400px 1fr;align-items:stretch}
.score-gauge{display:flex;flex-direction:column;justify-content:center;padding:24px 36px}
.score-gauge .gauge-cap{margin-top:12px}
.score-platforms{display:flex;flex-direction:column;justify-content:center;padding:24px 40px;border-left:1px solid var(--border)}
.score-platforms .sp-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-muted);margin-bottom:20px;display:block}
.score-platforms .pf-list{gap:24px}

/* ── Visibility by platform ── */
.platform-list{display:flex;flex-direction:column;gap:22px;padding:8px 0}
.platform-row{display:flex;flex-direction:column;gap:10px}
.platform-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
.platform-top .pname{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:600;color:var(--fg)}
.platform-top .pav{width:24px;height:24px;border-radius:var(--radius-md);background:var(--green-100);color:var(--primary);font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-style:normal;flex:0 0 auto}
.platform-top b{font-variant-numeric:tabular-nums;font-weight:700;font-size:16px;color:var(--fg)}
.platform-track{height:12px;background:var(--secondary);border-radius:var(--radius-full);overflow:hidden}
.platform-track i{display:block;height:100%;border-radius:var(--radius-full);background:var(--primary);transition:width var(--dur) var(--ease-out)}
.platform-track.medium i{background:var(--warning)}
.platform-track.low i{background:var(--destructive)}

/* ── Coverage / bar rows ── */
.coverage{display:flex;flex-direction:column;gap:15px}
.cov-list{display:flex;flex-direction:column}
.cov-list .coverage-row{padding:12px 20px;border-bottom:1px solid var(--border)}
.cov-list .coverage-row:last-child{border-bottom:0}
.coverage-row{display:grid;grid-template-columns:170px 1fr 76px;align-items:center;gap:14px}
.coverage-row>span{font-size:13px;font-weight:500}
.coverage-row .track{height:8px}
.coverage-row>strong{display:flex;align-items:baseline;gap:6px;justify-content:flex-end;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
.coverage-row>strong small{font-size:11px;color:var(--fg-muted);font-weight:400}

/* ── Leaderboards ── */
.controls-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;border-bottom:1px solid var(--border)}
.controls-head h2{font-size:15px;font-weight:600;margin:0}
.segmented{display:inline-flex;background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--radius-md);padding:2px;gap:2px}
.segmented button{border:0;background:none;padding:5px 11px;font-size:12px;font-weight:500;color:var(--fg-muted);border-radius:4px;cursor:pointer;transition:background var(--dur),color var(--dur)}
.segmented button:hover{color:var(--fg)}
.segmented button.active{background:var(--bg);color:var(--fg);box-shadow:var(--shadow-xs)}
.lb-list{display:flex;flex-direction:column}
.lb-row{display:grid;grid-template-columns:minmax(0,1fr) 130px 52px;align-items:center;gap:14px;padding:11px 20px;border-bottom:1px solid var(--border)}
.lb-row:last-child{border-bottom:0}
.lb-row.you{background:color-mix(in oklab,var(--primary) 5%,transparent)}
.lb-row .who{display:flex;flex-direction:column;min-width:0}
.lb-row .who strong{display:block;font-size:13px;font-weight:600;color:var(--fg);line-height:1.3}
.lb-row .who span{font-size:11px;color:var(--fg-muted)}
.lb-row.you .who span{color:var(--primary);font-weight:500}
.lb-row .track{height:8px}
.lb-row>b{text-align:right;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
.lb-row>small{text-align:right;font-size:11px;color:var(--fg-muted)}

/* ── Badges & pills ── */
.badge{display:inline-flex;align-items:center;border-radius:var(--radius-sm);padding:2px 7px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;background:var(--secondary);color:var(--fg-muted);white-space:nowrap}
.badge.platform{background:color-mix(in oklab,var(--accent) 12%,transparent);color:var(--accent)}
.badge.competitor{background:color-mix(in oklab,var(--destructive) 10%,transparent);color:var(--destructive)}
.badge.owned{background:color-mix(in oklab,var(--primary) 12%,transparent);color:var(--primary)}
.badge.others{background:color-mix(in oklab,var(--warning) 14%,transparent);color:#b56a1e}
.rank-pill{display:inline-flex;align-items:center;justify-content:center;min-width:34px;padding:3px 8px;border-radius:var(--radius-md);font-size:12px;font-weight:600;background:color-mix(in oklab,var(--primary) 12%,transparent);color:var(--primary);font-variant-numeric:tabular-nums}
.rank-pill.one{background:var(--primary);color:var(--primary-fg)}
.missing-pill{display:inline-flex;align-items:center;justify-content:center;padding:3px 9px;border-radius:var(--radius-md);font-size:12px;font-weight:500;background:var(--warning-soft);color:#b56a1e}
.error-pill{display:inline-flex;padding:3px 9px;border-radius:var(--radius-md);font-size:12px;font-weight:500;background:color-mix(in oklab,var(--destructive) 10%,transparent);color:var(--destructive)}
.dash{color:var(--fg-placeholder)}

/* ── Radar ── */
.radar-panel .panel-body{display:flex;gap:8px;align-items:center}
.radar-layout{display:grid;grid-template-columns:1fr 168px;gap:8px;align-items:center;width:100%}
.radar-chart{width:100%;height:auto;overflow:visible}
.radar-ring{fill:none;stroke:var(--border);stroke-width:1}
.radar-axis{stroke:var(--border);stroke-width:1}
.radar-chart text{font-size:9.5px;fill:var(--fg-muted);font-weight:500}
.radar-shape{fill:var(--radar-color);fill-opacity:.14;stroke:var(--radar-color);stroke-width:2;stroke-linejoin:round}
.radar-shape.competitor{fill-opacity:.05;stroke-width:1.5;stroke-dasharray:3 3}
.radar-legend{display:flex;flex-direction:column;gap:9px}
.radar-legend h3{font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-muted);margin:0 0 2px}
.radar-legend>div{display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:8px;font-size:12px}
.radar-legend i{width:10px;height:10px;border-radius:3px}
.radar-legend span{color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.radar-legend strong{font-variant-numeric:tabular-nums;font-weight:600}
.radar-legend .you span{font-weight:600}

/* ── Top prompt wins ── */
.tp-table{display:flex;flex-direction:column}
.tp-head,.tp-row{display:grid;grid-template-columns:minmax(0,1fr) 88px 92px;align-items:center;gap:12px;padding:11px 20px}
.tp-head{font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--fg-muted);background:color-mix(in oklab,var(--bg-muted) 60%,transparent);border-bottom:1px solid var(--border)}
.tp-row{border-bottom:1px solid var(--border)}
.tp-row:last-of-type{border-bottom:0}
.tp-text{display:flex;flex-direction:column;gap:5px;min-width:0}
.tp-text b{font-size:13px;font-weight:500;color:var(--fg);line-height:1.35}
.tp-text .badge{align-self:flex-start}
.tp-row>strong{font-size:13px;font-variant-numeric:tabular-nums;font-weight:600}
.text-cta{display:inline-flex;align-items:center;gap:5px;border:0;background:none;color:var(--primary);font-size:12px;font-weight:500;cursor:pointer;padding:13px 20px;width:100%;text-align:left;border-top:1px solid var(--border)}
.text-cta:hover{background:var(--bg-muted)}

/* ── Top list (citation domains overview) ── */
.rank-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 20px;border-bottom:1px solid var(--border)}
.rank-row:last-of-type{border-bottom:0}
.rank-row .lhs{display:flex;align-items:center;gap:8px;min-width:0}
.rank-row .lhs b{font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rank-row>strong{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}

/* ── Prompts view ── */
.prompt-tools{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border);flex-wrap:wrap}
.search{position:relative;flex:1;min-width:220px;max-width:360px}
.search svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--fg-muted)}
.search input{width:100%;padding:8px 12px 8px 32px;border:1px solid var(--border);border-radius:var(--radius-md);font-size:13px;outline:none;background:var(--bg)}
.search input:focus{border-color:var(--primary-hover);box-shadow:0 0 0 2px color-mix(in oklab,var(--primary-hover) 22%,transparent)}
.sort-note{font-size:12px;color:var(--fg-muted);margin-left:auto}
.intent-pills{display:flex;flex-wrap:wrap;gap:8px;padding:14px 20px;border-bottom:1px solid var(--border)}
.intent-pills button{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border);background:var(--bg);border-radius:var(--radius-full);padding:6px 12px;font-size:12px;font-weight:500;color:var(--fg-muted);cursor:pointer;transition:background var(--dur),border-color var(--dur),color var(--dur)}
.intent-pills button:hover{background:var(--bg-muted)}
.intent-pills button.active{background:color-mix(in oklab,var(--primary) 8%,transparent);border-color:color-mix(in oklab,var(--primary) 40%,var(--border));color:var(--primary)}
.intent-pills button span{font-variant-numeric:tabular-nums;opacity:.7}

.prompt-table{display:flex;flex-direction:column}
.prompt-head{display:grid;grid-template-columns:minmax(0,1fr) 106px 60px 60px 54px 112px;gap:8px;align-items:center;padding:10px 20px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--fg-muted);background:color-mix(in oklab,var(--bg-muted) 60%,transparent);border-bottom:1px solid var(--border)}
.prompt-record{border-bottom:1px solid var(--border)}
.prompt-record:last-child{border-bottom:0}
.prompt-row>span,.prompt-head>span{min-width:0}
.prompt-row{display:grid;grid-template-columns:minmax(0,1fr) 106px 60px 60px 54px 112px;gap:8px;align-items:center;padding:13px 20px;width:100%;border:0;background:none;text-align:left;cursor:pointer;transition:background var(--dur)}
.prompt-row:hover{background:color-mix(in oklab,var(--bg-muted) 40%,transparent)}
.prompt-record.open .prompt-row{background:color-mix(in oklab,var(--primary) 4%,transparent)}
.prompt-text{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--fg);min-width:0;font-weight:500}
.row-chev{flex:0 0 auto;color:var(--fg-placeholder);transition:transform var(--dur);font-style:normal;font-size:14px}
.row-chev.open{transform:rotate(90deg);color:var(--primary)}
.prompt-text .label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.insight-marker{font-style:normal;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;background:color-mix(in oklab,var(--warning) 16%,transparent);color:#b56a1e;padding:2px 6px;border-radius:var(--radius-full);flex:0 0 auto}
.comp-name{font-size:12px;color:var(--fg-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cell-center{display:flex;justify-content:flex-start}

/* prompt details */
.prompt-details{padding:4px 20px 20px;display:grid;grid-template-columns:repeat(2,1fr);gap:12px;background:color-mix(in oklab,var(--bg-muted) 40%,transparent)}
.answer-card{border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.answer-card.full{grid-column:1/-1}
.answer-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.answer-top>span{font-size:12px;color:var(--fg-muted);font-weight:500}
.answer-card ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:5px}
.answer-card ol li{font-size:13px;color:var(--fg)}
.answer-card ol li.you{font-weight:600;color:var(--primary)}
.answer-excerpt{font-size:12.5px;color:var(--fg-caption);line-height:1.5;margin:0;border-left:2px solid var(--border);padding-left:10px}
.missing-list{display:flex;flex-direction:column;gap:10px}
.missing-row{display:flex;flex-direction:column;gap:3px}
.missing-row strong{font-size:12px;color:var(--fg)}
.missing-row p{font-size:12.5px;color:var(--fg-caption);margin:0;line-height:1.5}
.insight-card .insight-q{font-size:12.5px;color:var(--fg);font-weight:600}
.insight-list{display:flex;flex-direction:column;gap:14px}
.insight-block{display:flex;flex-direction:column;gap:7px}
.insight-block+.insight-block{padding-top:14px;border-top:1px solid var(--border)}
.insight-surface{font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--fg-muted)}
.insight-intro{font-size:12.5px;color:var(--fg-caption);margin:0;line-height:1.55}
.insight-bullets{margin:0;padding-left:0;list-style:none;display:flex;flex-direction:column;gap:8px}
.insight-bullets li{font-size:12.5px;color:var(--fg-caption);line-height:1.55}
.insight-bullets li strong{color:var(--fg);font-weight:600}
.pc-list{display:flex;flex-direction:column;gap:8px}
.pc-row{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-md);transition:background var(--dur)}
.pc-row:hover{background:var(--bg-muted)}
.pc-row>span{font-size:12.5px;font-weight:500;color:var(--fg)}
.pc-row code{font-size:11px;color:var(--accent);font-family:var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-row small{font-size:11px;color:var(--fg-muted)}
.muted{color:var(--fg-muted);font-size:13px}

/* ── Citations view ── */
.citation-type-row .track i{background:var(--accent)}
.citation-type-row.competitor .track i{background:var(--destructive)}
.citation-type-row.owned .track i{background:var(--primary)}
.citation-type-row.others .track i{background:var(--warning)}
.src-table{display:flex;flex-direction:column}
.src-head{display:grid;grid-template-columns:minmax(0,1fr) 130px 90px 80px;gap:12px;padding:10px 20px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--fg-muted);background:color-mix(in oklab,var(--bg-muted) 60%,transparent);border-bottom:1px solid var(--border)}
.dom-group{border-bottom:1px solid var(--border)}
.dom-group:last-child{border-bottom:0}
.dom-row{display:grid;grid-template-columns:minmax(0,1fr) 130px 90px 80px;gap:12px;align-items:center;padding:12px 20px;width:100%;border:0;background:none;text-align:left;cursor:pointer;transition:background var(--dur)}
.dom-row:hover{background:color-mix(in oklab,var(--bg-muted) 40%,transparent)}
.dom-row.expanded{background:color-mix(in oklab,var(--primary) 4%,transparent)}
.dom-row strong{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;min-width:0}
.dom-row strong i{font-style:normal;color:var(--fg-placeholder);font-size:13px;width:12px}
.dom-row>span{font-size:13px;font-variant-numeric:tabular-nums;color:var(--fg)}
.dom-row>span .badge{font-size:10px}
.url-list{display:flex;flex-direction:column;gap:0;background:color-mix(in oklab,var(--bg-muted) 40%,transparent);padding:6px 20px 14px}
.url-row{display:grid;grid-template-columns:minmax(0,1fr) 80px 80px;gap:12px;align-items:start;padding:10px 0;border-bottom:1px solid var(--border)}
.url-row:last-child{border-bottom:0}
.url-row .u-main{min-width:0}
.url-row .u-main strong{display:block;font-size:12.5px;font-weight:500;color:var(--fg);margin-bottom:2px}
.url-row .u-main code{font-size:11px;color:var(--accent);font-family:var(--font-mono);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.url-row .u-main p{font-size:11px;color:var(--fg-muted);margin:5px 0 0;line-height:1.4}
.url-row>span{font-size:12px;color:var(--fg-muted);text-align:right;font-variant-numeric:tabular-nums}

/* ── Sentiment view ── */
.sentiment-hero{border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);padding:26px 28px}
.sentiment-hero .ov{font-size:13px;color:var(--fg-muted);font-weight:500}
.sent-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:2px}
.sentiment-score{display:block;font-size:46px;font-weight:600;letter-spacing:-.02em;color:var(--primary);margin:6px 0 18px;font-variant-numeric:tabular-nums;line-height:1}
.sent-meter{position:relative;height:8px;border-radius:var(--radius-full);background:linear-gradient(90deg,color-mix(in oklab,var(--destructive) 55%,white),var(--secondary) 50%,color-mix(in oklab,var(--success) 60%,white));width:100%}
.sent-meter i{position:absolute;top:50%;transform:translate(-50%,-50%);width:auto;min-width:42px;height:24px;display:flex;align-items:center;justify-content:center;background:var(--fg);color:#fff;border-radius:var(--radius-full);font-size:11px;font-weight:600;font-style:normal;box-shadow:var(--shadow-sm);font-variant-numeric:tabular-nums;padding:0 8px}
.sent-scale{display:flex;justify-content:space-between;margin-top:10px;font-size:11px;color:var(--fg-muted)}
.theme-panel.positive .panel-head h2{color:var(--success)}
.theme-panel.negative .panel-head h2{color:var(--destructive)}
.theme-block{display:flex;align-items:center;gap:12px;padding:13px 20px;border-bottom:1px solid var(--border)}
.theme-block:last-child{border-bottom:0}
.theme-mark{flex:0 0 22px;width:22px;height:22px;border-radius:var(--radius-full);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.theme-panel.positive .theme-mark{background:color-mix(in oklab,var(--success) 14%,transparent);color:var(--success)}
.theme-panel.negative .theme-mark{background:color-mix(in oklab,var(--destructive) 12%,transparent);color:var(--destructive)}
.theme-block em{flex:1;font-style:normal;font-size:13px;font-weight:500;color:var(--fg)}
.theme-block small{font-size:11px;color:var(--fg-muted)}
.theme-block strong{font-size:13px;font-variant-numeric:tabular-nums;font-weight:600;min-width:46px;text-align:right}
.comp-quote-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:18px 20px}
.comp-quote-card{border:1px solid var(--border);border-radius:var(--radius);padding:16px;display:flex;flex-direction:column;gap:6px}
.comp-quote-card h3{font-size:13px;font-weight:600;margin:0}
.comp-quote-card>span{font-size:11px;color:var(--fg-muted);margin-bottom:4px}
.comp-quote-card .ct{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--fg-caption);padding:6px 0;border-top:1px solid var(--border)}
.comp-quote-card .ct small{font-size:11px;color:var(--fg-muted);font-variant-numeric:tabular-nums}

/* ── Setup view ── */
.setup-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;align-items:start}
.form-panel{padding:20px}
.form-panel h2{font-size:15px;font-weight:600;margin:0 0 2px}
.form-panel .sub{font-size:12px;color:var(--fg-muted);margin-bottom:16px}
label.fld{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:500;color:var(--fg);margin-bottom:12px}
label.fld input,label.fld select,label.fld textarea{border:1px solid var(--border);border-radius:var(--radius-md);padding:8px 10px;font-size:13px;font-weight:400;outline:none;background:var(--bg)}
label.fld input:focus,label.fld select:focus,label.fld textarea:focus{border-color:var(--primary-hover);box-shadow:0 0 0 2px color-mix(in oklab,var(--primary-hover) 22%,transparent)}
label.fld textarea{resize:vertical;min-height:60px;font-family:inherit}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.form-panel fieldset{border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 14px;margin:0 0 12px}
.form-panel fieldset legend{font-size:12px;font-weight:500;color:var(--fg-muted);padding:0 4px}
.checks{display:grid;grid-template-columns:1fr 1fr;gap:8px}
label.check{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:400;cursor:pointer}
label.check input{width:15px;height:15px;accent-color:var(--primary)}
.run-list{display:flex;flex-direction:column;gap:8px;margin-top:14px}
.run-list button{display:flex;flex-direction:column;gap:2px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg);padding:10px 12px;text-align:left;cursor:pointer;transition:background var(--dur)}
.run-list button:hover{background:var(--bg-muted)}
.run-list strong{font-size:12px;font-weight:600;text-transform:capitalize}
.run-list span{font-size:11px;color:var(--fg-muted)}
.muted-block{display:flex;flex-direction:column;gap:4px;background:var(--bg-muted);border-radius:var(--radius-md);padding:12px 14px;margin-bottom:12px}
.muted-block strong{font-size:12px}
.muted-block span{font-size:12px;color:var(--fg-muted)}

/* ── Empty state ── */
.empty-state{padding:48px 32px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px}
.empty-state h2{font-size:18px;font-weight:600;margin:0}
.empty-state p{font-size:13px;color:var(--fg-muted);margin:0 0 8px;max-width:420px}

/* ── Responsive ── */
@media(max-width:1100px){
  .metric-grid.five{grid-template-columns:repeat(3,1fr)}
  .metric-grid.four{grid-template-columns:repeat(2,1fr)}
  .metric-grid.three{grid-template-columns:1fr}
  .hero-score{grid-template-columns:1fr;gap:20px}
  .hero-gauge .gauge-wrap{margin:0 auto}
  .dashboard-grid{grid-template-columns:1fr}
  .score-body{grid-template-columns:1fr}
  .score-platforms{border-left:0;border-top:1px solid var(--border)}
  .prompt-details{grid-template-columns:1fr}
  .comp-quote-grid{grid-template-columns:1fr}
  .setup-grid{grid-template-columns:1fr}
}

/* ── Print / PDF (Download PDF -> browser "Save as PDF") ── */
.print-header{display:none}
@media print{
  .aeo3{zoom:1}
  .side,.topbar,.text-cta,.segmented,.share-tools,.info-dot,.bench-note,.intent-pills,.prompt-tools{display:none !important}
  .workspace{display:block}
  .main{max-width:100%;padding:0;margin:0}
  .view-stack{gap:10px}
  html,body,.aeo3,.app,.workspace,.main{background:#fff !important}
  .panel,.metric-card,.score-panel,.sentiment-hero,.hero-score,.dashboard-grid>*{break-inside:avoid;page-break-inside:avoid;box-shadow:none !important}
  .print-header{display:flex !important;align-items:center;justify-content:space-between;gap:12px;border-bottom:2px solid var(--primary);padding-bottom:12px;margin-bottom:16px}
  .print-header img{height:22px}
  .print-header .ph-meta{font-size:12px;color:var(--fg-muted);text-align:right}
  .print-header .ph-meta strong{display:block;font-size:15px;color:var(--fg)}
  @page{margin:12mm}
}
`;
