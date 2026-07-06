import { spawn } from "node:child_process";
import fs from "node:fs";

const URL = process.argv[2];
const OUT = process.argv[3] || "/tmp/citations.png";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9243;
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${PORT}`, "--window-size=1440,1700", "--force-device-scale-factor=1", "about:blank"]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  let target;
  for (let i = 0; i < 40; i++) {
    try { const list = await (await fetch(`http://localhost:${PORT}/json`)).json(); target = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl); if (target) break; } catch {}
    await wait(250);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  await new Promise((r) => ws.addEventListener("open", r));
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = (expression) => send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  const pollUntil = async (expr, label, tries = 40) => { for (let i = 0; i < tries; i++) { const r = await evaluate(expr); if (r.result?.value) return r.result.value; await wait(400); } console.log("timeout:", label); return null; };
  const clickText = (sel, text) => evaluate(`(()=>{const n=[...document.querySelectorAll('${sel}')].find(e=>e.textContent.trim()==='${text}');if(n){n.click();return true}return false})()`);

  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate", { url: URL });
  await pollUntil(`!!document.querySelector('.acct-company')`, "app load");
  await wait(1500);
  await clickText("button,a,[role=button],.navi", "Citations");
  await pollUntil(`!!document.querySelector('.cit-controls')`, "cit controls");
  await wait(700);
  // platform -> Gemini
  await clickText(".cit-controls .segmented button", "Gemini");
  await wait(900);
  // intent -> Intention-driven
  await clickText(".cit-controls .segmented button", "Intention-driven");
  await wait(1200);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  fs.writeFileSync(OUT, Buffer.from(shot.result.data, "base64"));
  console.log("saved", OUT);
  ws.close();
}
run().catch((e) => console.error("ERR", e.message)).finally(() => chrome.kill());
