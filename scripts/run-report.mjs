import http from "node:http";

const id = process.argv[2];
const port = process.argv[3] || "3000";
if (!id) {
  console.error("usage: node run-report.mjs <reportId> [port]");
  process.exit(1);
}

console.log(`start ${new Date().toISOString()} — running ${id} on :${port}`);

const req = http.request(
  { host: "127.0.0.1", port: Number(port), path: `/api/reports/${id}/run`, method: "POST", headers: { "Content-Type": "application/json" } },
  (res) => {
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => {
      try {
        const r = JSON.parse(body);
        const errs = (r.runs || []).filter((x) => String(x.rawAnswer).startsWith("Provider error:"));
        const bySurface = {};
        for (const run of r.runs || []) bySurface[run.surface] = (bySurface[run.surface] || 0) + 1;
        console.log(`DONE status=${r.status} runs=${(r.runs || []).length} errors=${errs.length}`);
        console.log("bySurface:", JSON.stringify(bySurface));
        const eByMsg = {};
        for (const e of errs) { const k = String(e.rawAnswer).slice(0, 60); eByMsg[k] = (eByMsg[k] || 0) + 1; }
        console.log("errorSample:", JSON.stringify(eByMsg, null, 2));
      } catch (e) {
        console.log("response (non-json):", body.slice(0, 500));
      }
      console.log(`end ${new Date().toISOString()}`);
    });
  }
);
req.on("error", (e) => console.error("REQ ERROR", e.message));
req.end();
