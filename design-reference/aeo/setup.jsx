/* global React, AEO, PanelHead */
const { useState: useStateSet } = React;

const HVAC_SERVICES = ["AC repair", "AC installation", "Furnace repair", "Furnace installation", "Heat pump repair", "Ductless mini split", "Indoor air quality", "Duct cleaning", "Emergency HVAC", "Maintenance/tune-up"];

function SetupView() {
  const [services, setServices] = useStateSet(["AC repair", "Furnace repair", "Emergency HVAC", "Heat pump repair", "Maintenance/tune-up"]);
  const [repeat, setRepeat] = useStateSet(1);
  const toggle = (s) => setServices((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s]));
  const runs = [
    { status: "complete", queries: 28, when: "May 19, 2026, 5:13 PM" },
    { status: "complete", queries: 18, when: "May 19, 2026, 4:57 PM" },
    { status: "draft", queries: 32, when: "May 19, 2026, 4:41 PM" },
    { status: "draft", queries: 31, when: "May 19, 2026, 4:22 PM" },
  ];

  return (
    <section className="setup-grid">
      <form className="panel form-panel" onSubmit={(e) => e.preventDefault()}>
        <h2>Create HVAC company</h2>
        <div className="sub">Manual inputs for the audit profile.</div>
        <label className="fld">Business name<input defaultValue="AllTech Services, Inc." /></label>
        <label className="fld">Website<input defaultValue="https://alltechservices.com" /></label>
        <label className="fld">Google Business Profile URL<input placeholder="https://maps.google.com/…" /></label>
        <div className="two-col">
          <label className="fld">Primary city<input defaultValue="Sterling" /></label>
          <label className="fld">State<input defaultValue="VA" /></label>
        </div>
        <div className="two-col">
          <label className="fld">Latitude<input placeholder="39.0067" /></label>
          <label className="fld">Longitude<input placeholder="-77.4286" /></label>
        </div>
        <fieldset>
          <legend>HVAC services</legend>
          <div className="checks">
            {HVAC_SERVICES.map((s) => (
              <label key={s} className="check"><input type="checkbox" checked={services.includes(s)} onChange={() => toggle(s)} />{s}</label>
            ))}
          </div>
        </fieldset>
        <label className="fld">Known competitors
          <textarea defaultValue={"Cardinal Plumbing Heating & Air\nVernon The Heating & Cooling Specialist\nMeade's Heating and Air"} />
        </label>
        <button className="btn primary" type="submit" style={{ marginTop: "4px" }}>Save company</button>
      </form>

      <div className="panel form-panel">
        <h2>Run report</h2>
        <div className="sub">Generate and run a tracked audit query set.</div>
        <label className="fld">Company
          <select defaultValue="AllTech Services, Inc."><option>AllTech Services, Inc.</option></select>
        </label>
        <label className="fld">Repeat runs per query / platform
          <input type="number" min={1} max={10} value={repeat} onChange={(e) => setRepeat(Number(e.target.value))} />
        </label>
        <div className="muted-block">
          <strong>Locations in this account</strong>
          <span>Sterling, VA · primary</span>
          <span>Ashburn, VA</span>
        </div>
        <button className="btn primary" type="button">Generate query set</button>

        <div className="run-list">
          {runs.map((r, i) => (
            <button key={i} type="button">
              <strong>{r.status}</strong>
              <span>{r.queries} queries · {r.when}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
window.SetupView = SetupView;
