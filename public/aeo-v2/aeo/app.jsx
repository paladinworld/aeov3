/* global React, ReactDOM, AEO, Icon, OverviewView, PromptsView, CitationsView, SentimentView, SetupView */
const { useState: useStateApp } = React;

const NAV = {
  home: "Overview", prompts: "Prompts", citations: "Citations", sentiment: "Sentiment", setup: "Setup",
};

function App() {
  const [view, setView] = useStateApp("home");
  const [copied, setCopied] = useStateApp(false);
  const co = AEO.company;
  const total = AEO.metrics.totalQueries;

  const copyLink = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <img src="aeo/assets/netic-wordmark-green.svg" alt="Netic" />
          <span className="beta-pill">Beta</span>
        </div>
        <div className="brand-sub">AI Visibility Insights</div>

        <div className="acct">
          <label htmlFor="acct">Company</label>
          <div className="sel">
            <select id="acct" defaultValue="alltech">
              <option value="alltech">{co.name} — {co.location}</option>
            </select>
            <Icon name="chevdown" size={14} />
          </div>
          <span className="loc">{co.location}</span>
        </div>

        <NavGroup label="Overview">
          <Navi icon="home" active={view === "home"} count={total} onClick={() => setView("home")}>Home</Navi>
        </NavGroup>
        <NavGroup label="Visibility">
          <Navi icon="prompts" active={view === "prompts"} count={total} onClick={() => setView("prompts")}>Prompts</Navi>
          <Navi icon="citations" active={view === "citations"} onClick={() => setView("citations")}>Citations</Navi>
          <Navi icon="competitors" disabled soon>Competitors</Navi>
          <Navi icon="sentiment" active={view === "sentiment"} onClick={() => setView("sentiment")}>Sentiment</Navi>
        </NavGroup>
        <NavGroup label="Configure">
          <Navi icon="setup" active={view === "setup"} onClick={() => setView("setup")}>Setup</Navi>
        </NavGroup>

        <div className="side-foot">
          <div className="av">AS</div>
          <div><div className="nm">AllTech ops</div><div className="rl">operator</div></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-inner">
          <div className="crumb">
            {co.name} <Icon name="chevron" size={13} /> AI Visibility <Icon name="chevron" size={13} /> <b>{NAV[view]}</b>
          </div>
          <div className="top-actions">
            <span className="last-run">Last run May 19, 2026</span>
            <div className="share-tools">
              <button className="btn" onClick={copyLink}><Icon name={copied ? "copy" : "share"} size={13} />{copied ? "Copied" : "Share report"}</button>
              <button className="btn"><Icon name="mail" size={13} />Gmail</button>
            </div>
          </div>
          </div>
        </header>

        <div className="main">
          {view === "home" ? <OverviewView onNav={setView} />
            : view === "prompts" ? <PromptsView />
            : view === "citations" ? <CitationsView />
            : view === "sentiment" ? <SentimentView />
            : <SetupView />}
        </div>
      </section>
    </div>
  );
}

function NavGroup({ label, children }) {
  return <div className="nav-group"><span>{label}</span>{children}</div>;
}
function Navi({ icon, active, disabled, soon, count, onClick, children }) {
  return (
    <button className={"navi" + (active ? " active" : "")} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={16} />
      <span>{children}</span>
      {soon ? <span className="soon">Soon</span> : typeof count === "number" ? <span className="count">{count}</span> : null}
    </button>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
