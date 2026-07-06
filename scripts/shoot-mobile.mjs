import { spawn } from "node:child_process";
import fs from "node:fs";

const URL = process.argv[2];
const PREFIX = process.argv[3] || "/tmp/m";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9251;
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${PORT}`, "about:blank"]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  let target;
  for (let i = 0; i < 40; i++) {
    try { const list = await (await fetch(`http://localhost:${PORT}/json`)).json(); target = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl); if (target) break; } catch {}
    await wait(250);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const listeners = [];
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method) listeners.forEach((l) => l(m)); });
  await new Promise((r) => ws.addEventListener("open", r));
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = (expression) => send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  const onceEvent = (method, ms = 15000) => new Promise((res) => { const t = setTimeout(() => res(false), ms); const l = (m) => { if (m.method === method) { clearTimeout(t); res(true); } }; listeners.push(l); });
  const pollUntil = async (expr, label, tries = 50) => { for (let i = 0; i < tries; i++) { const r = await evaluate(expr); if (r.result?.value) return r.result.value; await wait(400); } console.log("timeout:", label); return null; };
  const shoot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); fs.writeFileSync(`${PREFIX}-${name}.png`, Buffer.from(s.result.data, "base64")); console.log("saved", `${PREFIX}-${name}.png`); };
  const click = (sel) => evaluate(`(()=>{const n=document.querySelector('${sel}');if(n){n.click();return true}return false})()`);
  const clickText = (sel, text) => evaluate(`(()=>{const n=[...document.querySelectorAll('${sel}')].find(e=>e.textContent.trim()==='${text}');if(n){n.click();return true}return false})()`);

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const loaded = onceEvent("Page.loadEventFired");
  await send("Page.navigate", { url: URL });
  await loaded;
  await send("Runtime.enable");
  await pollUntil(`!!document.querySelector('.acct-company')`, "app load");
  await wait(2500);

  await shoot("home");
  // open drawer
  await click(".nav-toggle");
  await wait(700);
  await shoot("drawer");
  // go to Prompts
  await clickText(".side .navi", "Prompts");
  await wait(1800);
  await shoot("prompts");
  // go to Citations
  await click(".nav-toggle"); await wait(500);
  await clickText(".side .navi", "Citations");
  await wait(1800);
  await shoot("citations");
  ws.close();
}
run().catch((e) => console.error("ERR", e.message)).finally(() => chrome.kill());
