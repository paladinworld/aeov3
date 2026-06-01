export const v2Styles = `
@import url("https://rsms.me/inter/inter.css");

:root {
  --netic-green: hsl(147 73% 27%);
  --netic-green-hover: hsl(147 73% 32%);
  --netic-green-soft: hsl(147 40% 93%);
  --netic-green-bar: hsl(147 52% 41%);
  --netic-green-deep: hsl(147 75% 20%);
  --netic-cream: hsl(48 100% 98%);
  --bg: hsl(0 0% 100%);
  --bg-muted: hsl(0 0% 97.3%);
  --bg-sidebar: hsl(0 0% 98%);
  --surface-card: hsl(0 0% 96%);
  --fg: hsl(0 0% 18.8%);
  --fg-caption: hsl(0 0% 39.2%);
  --fg-muted: hsl(0 0% 45.1%);
  --fg-placeholder: hsl(0 0% 63.1%);
  --border: hsl(210 8% 90%);
  --border-strong: hsl(0 0% 82%);
  --accent: hsl(212 56% 48.8%);
  --destructive: hsl(0 73% 45%);
  --success: hsl(147 52% 41%);
  --warning: hsl(29 80% 55%);
  --warning-soft: hsl(44 92% 92%);
  --radius-md: 6px;
  --radius: 8px;
  --radius-lg: 12px;
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.05);
  --shadow-overlay: 0 20px 40px -8px rgba(0,0,0,0.20);
}

.aeo-v2 {
  min-height: 100vh;
  grid-template-columns: 250px minmax(0, 1fr);
  background: var(--bg-muted);
  color: var(--fg);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 14px;
  font-weight: 400;
}

body:has(.aeo-v2) {
  zoom: 1;
  background: var(--bg-muted);
}

.aeo-v2 *,
.aeo-v2 *::before,
.aeo-v2 *::after {
  letter-spacing: 0;
}

.aeo-v2 .sidebar {
  gap: 22px;
  border-right: 1px solid var(--border);
  background: var(--bg-sidebar);
  padding: 28px 14px;
}

.aeo-v2 .brand {
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  padding: 0 12px 24px;
  color: var(--netic-green);
}

.aeo-v2 .netic-logo {
  width: 84px;
  height: auto;
}

.aeo-v2 .brand-subline,
.aeo-v2 .account-switcher-body label,
.aeo-v2 .nav-group > span,
.aeo-v2 .metric-card > span,
.aeo-v2 .panel-title h2 {
  color: var(--fg-muted);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.aeo-v2 .brand-subline {
  margin-top: 5px;
}

.aeo-v2 .beta-pill {
  border: 1px solid color-mix(in srgb, var(--warning) 35%, white);
  background: var(--warning-soft);
  color: #8a560f;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 4px 7px;
}

.aeo-v2 .account-card {
  border-bottom: 1px solid var(--border);
  padding: 4px 12px 24px;
}

.aeo-v2 .account-card span,
.aeo-v2 .last-run,
.aeo-v2 .page-note,
.aeo-v2 .benchmark-note,
.aeo-v2 .muted,
.aeo-v2 .sort-note,
.aeo-v2 .panel-title span,
.aeo-v2 .metric-card small {
  color: var(--fg-muted);
}

.aeo-v2 .account-switcher-body select,
.aeo-v2 input,
.aeo-v2 select,
.aeo-v2 textarea {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--fg);
  font-size: 14px;
  padding: 10px 12px;
}

.aeo-v2 .account-switcher-body select {
  color: var(--netic-green);
  font-weight: 600;
}

.aeo-v2 input:focus,
.aeo-v2 select:focus,
.aeo-v2 textarea:focus,
.aeo-v2 button:focus-visible,
.aeo-v2 a:focus-visible {
  outline: 2px solid var(--netic-green-hover);
  outline-offset: 2px;
}

.aeo-v2 .nav-group {
  gap: 6px;
}

.aeo-v2 .nav-group button {
  border-radius: var(--radius-md);
  color: var(--fg-caption);
  font-size: 14px;
  font-weight: 400;
  padding: 10px 12px;
  transition: background-color 160ms cubic-bezier(0.16, 1, 0.3, 1), color 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.aeo-v2 .nav-group button:hover:not(:disabled) {
  background: var(--bg-muted);
  color: var(--fg);
}

.aeo-v2 .nav-group button.active {
  background: var(--netic-green-soft);
  color: var(--netic-green);
  font-weight: 500;
}

.aeo-v2 .nav-group small,
.aeo-v2 .soon {
  border-radius: 999px;
  background: #fff;
  color: var(--fg-muted);
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
}

.aeo-v2 .nav-group button.active small {
  background: hsl(147 42% 84%);
  color: var(--netic-green);
}

.aeo-v2 .workspace {
  background: var(--bg-muted);
}

.aeo-v2 .workspace-top {
  border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,0.96);
  backdrop-filter: none;
  padding: 16px 0;
}

.aeo-v2 .topbar-inner,
.aeo-v2 .view-stack,
.aeo-v2 .setup-grid {
  width: min(1176px, calc(100vw - 320px));
  margin-inline: auto;
}

.aeo-v2 .topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.aeo-v2 .crumb {
  color: var(--fg-muted);
  font-size: 13px;
}

.aeo-v2 .crumb span {
  color: var(--fg-placeholder);
}

.aeo-v2 .crumb strong {
  color: var(--fg);
  font-weight: 600;
}

.aeo-v2 .share-toolbar a,
.aeo-v2 .share-toolbar button,
.aeo-v2 .share-actions button,
.aeo-v2 .primary,
.aeo-v2 .secondary,
.aeo-v2 .text-cta,
.aeo-v2 .segmented button,
.aeo-v2 .intent-pills button {
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
}

.aeo-v2 .share-toolbar a,
.aeo-v2 .primary {
  border-color: var(--netic-green);
  background: var(--netic-green);
  color: #fff;
}

.aeo-v2 .share-toolbar a:hover,
.aeo-v2 .primary:hover:not(:disabled) {
  background: var(--netic-green-hover);
}

.aeo-v2 .share-toolbar button,
.aeo-v2 .secondary {
  border: 1px solid var(--border);
  background: #fff;
  color: var(--fg);
}

.aeo-v2 .view-stack,
.aeo-v2 .setup-grid {
  padding: 28px 0 56px;
}

.aeo-v2 .view-stack {
  gap: 24px;
}

.aeo-v2 .page-note {
  max-width: 780px;
  margin: -8px 0 0;
  font-size: 14px;
  line-height: 1.55;
}

.aeo-v2 .benchmark-note {
  margin: -10px 0 0;
  font-size: 12px;
}

.aeo-v2 .panel,
.aeo-v2 .metric-card,
.aeo-v2 .answer-card,
.aeo-v2 .competitor-quote-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: #fff;
  box-shadow: none;
}

.aeo-v2 .panel {
  padding: 24px;
}

.aeo-v2 .metric-grid {
  gap: 12px;
}

.aeo-v2 .metric-grid.five {
  grid-template-columns: repeat(5, minmax(150px, 1fr));
}

.aeo-v2 .metric-card {
  min-height: 120px;
  padding: 18px 20px;
}

.aeo-v2 .metric-card strong {
  color: var(--fg);
  font-size: 31px;
  font-weight: 600;
  letter-spacing: 0;
}

.aeo-v2 .metric-card.compact strong {
  font-size: 18px;
  line-height: 1.25;
}

.aeo-v2 .metric-card.rust strong,
.aeo-v2 .metric-card.gold strong,
.aeo-v2 .metric-card.green strong {
  color: var(--fg);
}

.aeo-v2 .status-pill {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.aeo-v2 .status-pill.high,
.aeo-v2 .rank-pill.one {
  background: hsl(147 60% 94%);
  color: var(--netic-green);
}

.aeo-v2 .status-pill.medium {
  background: var(--warning-soft);
  color: #8a560f;
}

.aeo-v2 .status-pill.low,
.aeo-v2 .missing-pill,
.aeo-v2 .error-pill {
  background: hsl(0 80% 96%);
  color: var(--destructive);
}

.aeo-v2 .dashboard-grid {
  grid-template-columns: minmax(0, 1.14fr) minmax(300px, 0.78fr);
  gap: 16px;
}

.aeo-v2 .panel-title {
  border-bottom: 1px solid var(--border);
  margin: -24px -24px 20px;
  padding: 18px 24px;
}

.aeo-v2 .panel-title h2 {
  color: var(--fg);
  font-size: 16px;
  letter-spacing: 0;
  text-transform: none;
}

.aeo-v2 .panel-title span {
  font-size: 13px;
}

.aeo-v2 .track {
  height: 7px;
  background: hsl(0 0% 92.5%);
}

.aeo-v2 .track i,
.aeo-v2 .surface-mini-row .track i,
.aeo-v2 .mention-bar > i {
  background: var(--netic-green-bar);
}

.aeo-v2 .coverage-row {
  grid-template-columns: minmax(170px, 220px) minmax(140px, 1fr) 64px;
  gap: 14px;
  font-size: 14px;
}

.aeo-v2 .rank-row,
.aeo-v2 .source-row,
.aeo-v2 .top-prompt-row,
.aeo-v2 .prompt-row {
  border-color: var(--border);
}

.aeo-v2 .rank-row {
  font-size: 14px;
  padding: 13px 0;
}

.aeo-v2 .mention-share-list {
  display: grid;
  gap: 0;
}

.aeo-v2 .mention-share-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 132px 48px 62px;
  align-items: center;
  gap: 8px 12px;
  border-bottom: 1px solid var(--border);
  margin: 0;
  padding: 13px 0;
}

.aeo-v2 .mention-share-row.you {
  border-bottom-color: transparent;
  border-radius: var(--radius-md);
  background: hsl(147 40% 96%);
  margin: 6px 0;
  padding: 13px 12px;
}

.aeo-v2 .mention-share-row > div:first-of-type {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.aeo-v2 .mention-share-row strong {
  overflow-wrap: anywhere;
  color: var(--fg);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}

.aeo-v2 .mention-share-row.you strong {
  color: var(--netic-green);
}

.aeo-v2 .mention-share-row span,
.aeo-v2 .mention-share-row small {
  color: var(--fg-muted);
  font-size: 12px;
  font-weight: 400;
}

.aeo-v2 .mention-share-row b {
  color: var(--fg);
  font-size: 14px;
  font-weight: 600;
  text-align: right;
}

.aeo-v2 .mention-share-row.you b {
  color: var(--netic-green);
}

.aeo-v2 .mention-share-row > small:not(.your-position) {
  justify-self: end;
  white-space: nowrap;
}

.aeo-v2 .mention-share-row .mention-bar {
  grid-column: auto;
}

.aeo-v2 .mention-bar {
  width: 132px;
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: hsl(0 0% 93%);
}

.aeo-v2 .mention-bar i,
.aeo-v2 .mention-bar.high i,
.aeo-v2 .mention-bar.medium i,
.aeo-v2 .mention-bar.low i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--netic-green-bar);
}

.aeo-v2 .your-position {
  grid-column: 1 / -1;
  color: var(--netic-green);
  font-size: 11px;
  font-weight: 500;
}

.aeo-v2 .badge {
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-muted);
  color: var(--fg-caption);
  font-size: 11px;
  font-weight: 600;
}

.aeo-v2 .badge.owned {
  background: hsl(147 60% 94%);
  border-color: hsl(147 40% 84%);
  color: var(--netic-green);
}

.aeo-v2 .badge.platform {
  background: hsl(213 70% 96%);
  border-color: hsl(213 50% 88%);
  color: var(--accent);
}

.aeo-v2 .badge.competitor {
  background: hsl(0 80% 97%);
  border-color: hsl(0 60% 90%);
  color: var(--destructive);
}

.aeo-v2 .segmented {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-muted);
  padding: 3px;
}

.aeo-v2 .segmented button {
  border: 0;
  background: transparent;
  color: var(--fg-muted);
  padding: 7px 10px;
}

.aeo-v2 .segmented button.active {
  background: #fff;
  color: var(--fg);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

.aeo-v2 .prompt-tools {
  display: grid;
  grid-template-columns: 360px auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--border);
  margin: 0;
  padding: 16px 20px;
}

.aeo-v2 .prompt-panel {
  overflow: hidden;
  padding: 0;
}

.aeo-v2 .search-field {
  position: relative;
  display: block;
  margin: 0;
}

.aeo-v2 .search-field svg {
  position: absolute;
  left: 11px;
  top: 50%;
  width: 14px;
  height: 14px;
  color: var(--fg-muted);
  fill: none;
  pointer-events: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  transform: translateY(-50%);
}

.aeo-v2 .search-field input {
  height: 34px;
  padding: 7px 12px 7px 34px;
}

.aeo-v2 .prompt-tools .segmented {
  height: 34px;
}

.aeo-v2 .prompt-tools .segmented button {
  height: 26px;
  padding: 0 11px;
}

.aeo-v2 .sort-note {
  justify-self: end;
  font-size: 13px;
}

.aeo-v2 .intent-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  background: #fff;
  margin: 0;
  padding: 14px 20px;
}

.aeo-v2 .intent-pills button {
  border: 1px solid var(--border);
  border-radius: 999px;
  background: #fff;
  color: var(--fg-caption);
  height: 30px;
  padding: 0 13px;
  font-size: 13px;
  font-weight: 500;
}

.aeo-v2 .intent-pills button.active {
  border-color: var(--netic-green);
  background: hsl(147 60% 96%);
  color: var(--netic-green);
  box-shadow: none;
}

.aeo-v2 .intent-pills span {
  color: inherit;
  padding-left: 3px;
}

.aeo-v2 .prompt-table,
.aeo-v2 .source-table,
.aeo-v2 .top-prompt-table {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.aeo-v2 .prompt-table {
  min-width: 0;
  border: 0;
  border-radius: 0;
}

.aeo-v2 .prompt-head,
.aeo-v2 .prompt-row {
  display: grid;
  grid-template-columns: minmax(360px, 1fr) 112px 76px 88px 62px 176px;
  align-items: center;
  gap: 12px;
}

.aeo-v2 .prompt-head,
.aeo-v2 .source-head,
.aeo-v2 .top-prompt-head {
  background: var(--bg-muted);
  color: var(--fg-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.aeo-v2 .prompt-head {
  border-bottom: 1px solid var(--border);
  padding: 12px 20px;
}

.aeo-v2 .prompt-record {
  border-bottom: 1px solid var(--border);
}

.aeo-v2 .prompt-row {
  width: 100%;
  border: 0;
  background: #fff;
  cursor: pointer;
  padding: 14px 20px;
  text-align: left;
}

.aeo-v2 .prompt-row:hover,
.aeo-v2 .source-row:hover,
.aeo-v2 .top-prompt-row:hover {
  background: hsl(0 0% 98%);
}

.aeo-v2 .prompt-record:has(.prompt-details) .prompt-row {
  background: hsl(147 60% 97%);
}

.aeo-v2 .prompt-text {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  color: var(--fg);
  flex-wrap: nowrap;
  font-size: 14px;
  gap: 4px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aeo-v2 .prompt-record:has(.prompt-details) .prompt-text {
  color: hsl(147 70% 16%);
}

.aeo-v2 .row-chevron {
  color: var(--netic-green);
  font-style: normal;
  font-weight: 600;
  transform: rotate(0deg);
}

.aeo-v2 .row-chevron.open {
  transform: rotate(90deg);
}

.aeo-v2 .competitor-name {
  color: hsl(10 70% 40%);
  font-weight: 500;
  line-height: 1.2;
}

.aeo-v2 .rank-pill,
.aeo-v2 .missing-pill,
.aeo-v2 .error-pill {
  border-radius: 999px;
  justify-content: center;
  min-width: 54px;
  min-height: 22px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
}

.aeo-v2 .rank-pill {
  background: hsl(147 60% 94%);
  color: var(--netic-green);
}

.aeo-v2 .prompt-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  background: #fff;
  border-top: 1px solid var(--border);
  padding: 0 24px 16px;
}

.aeo-v2 .answer-card {
  border-radius: var(--radius);
  padding: 14px 16px;
}

.aeo-v2 .answer-top {
  border-bottom: 1px solid var(--border);
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 6px;
}

.aeo-v2 .answer-card ol {
  gap: 6px;
  padding-left: 20px;
}

.aeo-v2 .prompt-citations-card,
.aeo-v2 .prompt-insights-card {
  grid-column: 1 / -1;
}

.aeo-v2 .answer-excerpt,
.aeo-v2 .targeted-prompt-box,
.aeo-v2 code {
  color: var(--fg-muted);
}

.aeo-v2 .sentiment-hero {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: #fff;
  box-shadow: none;
}

.aeo-v2 .sentiment-score {
  color: var(--fg);
}

.aeo-v2 .sentiment-meter {
  background: linear-gradient(90deg, hsl(0 80% 96%), hsl(44 92% 92%), hsl(147 60% 94%));
}

.aeo-v2 .sentiment-meter i {
  background: var(--fg);
}

.aeo-v2 .radar-shape.target {
  fill: color-mix(in srgb, var(--netic-green) 18%, transparent);
  stroke: var(--netic-green);
}

.aeo-v2 .radar-shape.competitor {
  fill: color-mix(in srgb, var(--radar-color) 10%, transparent);
}

@media (max-width: 760px) {
  .aeo-v2 {
    grid-template-columns: 1fr;
  }

  .aeo-v2 .sidebar {
    position: static;
    min-height: auto;
  }

  .aeo-v2 .metric-grid.five,
  .aeo-v2 .metric-grid.four,
  .aeo-v2 .dashboard-grid,
  .aeo-v2 .setup-grid {
    grid-template-columns: 1fr;
  }

  .aeo-v2 .workspace-top,
  .aeo-v2 .top-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .aeo-v2 .topbar-inner,
  .aeo-v2 .view-stack,
  .aeo-v2 .setup-grid {
    width: calc(100vw - 32px);
  }
}
`;
