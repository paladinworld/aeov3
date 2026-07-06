import { spawn } from "node:child_process";
import fs from "node:fs";

const URL = process.argv[2];
const OUT = process.argv[3] || "/tmp/insight.png";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9242;

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`, "--window-size=1440,2200",
  "--force-device-scale-factor=1", "about:blank"
]);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp() {
  // find the page target
  let target;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://localhost:${PORT}/json`)).json();
      target = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (target) break;
    } catch {}
    await wait(250);
  }
  if (!target) throw new Error("no devtools target");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise((r) => ws.addEventListener("open", r));
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = (expression) => send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: URL });

  const pollUntil = async (expr, label, tries = 40) => {
    for (let i = 0; i < tries; i++) {
      const r = await evaluate(expr);
      if (r.result?.value) return r.result.value;
      await wait(400);
    }
    console.log("timeout:", label);
    return null;
  };

  // app loaded?
  await pollUntil(`!!document.querySelector('.acct-company')`, "app load");
  await wait(1500);
  // 1) Prompts tab — click then confirm rows present
  await evaluate(`(() => { const n=[...document.querySelectorAll('button,a,[role=button],.navi')].find(e=>e.textContent.trim()==='Prompts'); n&&n.click(); })()`);
  await pollUntil(`document.querySelectorAll('.prompt-row').length>0`, "prompt rows");
  await wait(800);
  // 2) expand the not-ranked prompt, then confirm the insight card appears
  await evaluate(`(() => { const rows=[...document.querySelectorAll('.prompt-row')]; const t=rows.find(r=>/best heating and air conditioning/i.test(r.textContent)); if(t){t.click();} })()`);
  const hasCard = await pollUntil(`!!document.querySelector('.insight-card')`, "insight card");
  console.log("insight card present:", hasCard);
  await wait(800);

  // clip to the insight card for a readable crop
  const rect = await evaluate(`(() => { const c=document.querySelector('.insight-card'); if(!c) return null; c.scrollIntoView({block:'center'}); const r=c.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()`);
  const box = rect.result?.value;
  await wait(500);
  const params = { format: "png", captureBeyondViewport: true };
  if (box) params.clip = { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: box.width + 16, height: box.height + 16, scale: 2 };
  const shot = await send("Page.captureScreenshot", params);
  fs.writeFileSync(OUT, Buffer.from(shot.result.data, "base64"));
  console.log("saved", OUT, "clip:", !!box);
  ws.close();
}

cdp().catch((e) => { console.error("ERR", e.message); }).finally(() => { chrome.kill(); });
