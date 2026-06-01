/* global React, AEO, Leaderboard, pct */
const { useState: useStateCo } = React;

function CompetitorsView() {
  const [vf, setVf] = useStateCo("all");
  const [sf, setSf] = useStateCo("all");
  const m = AEO.metrics;
  return (
    <div className="view-stack">
      <p className="page-note">
        How {AEO.company.name.split(",")[0]} ranks against other HVAC companies in {AEO.company.location}, across {m.totalQueries} tracked prompts.
      </p>
      <p className="bench-note">
        Ranked by how often each company is named across ChatGPT and Gemini. Switch a list to a single platform with the toggle.
      </p>

      <section className="dashboard-grid">
        <Leaderboard title="Visibility score rank" data={AEO.visibilityLeaderboard} filter={vf} setFilter={setVf} mode="vis" limit={10} />
        <Leaderboard title="Share of voice rank" data={AEO.visibilityLeaderboard} filter={sf} setFilter={setSf} mode="sov" limit={10} />
      </section>
    </div>
  );
}
window.CompetitorsView = CompetitorsView;
