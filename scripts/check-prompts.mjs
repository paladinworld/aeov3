#!/usr/bin/env node
// Prompt-set lock — every vertical's prompt list is a fixed, comparable contract
// (see AUDIT-RUNBOOK.md / the comments in lib/query-generator.ts). This guard fails if
// any vertical's prompts change (text, count, category, priority, etc.) so the locked
// sets can't drift silently and break cross-company/over-time comparability.
//
//   node scripts/check-prompts.mjs            # verify against snapshot (exit 1 on drift)
//   node scripts/check-prompts.mjs --update   # accept current sets as the new snapshot
//
// Wired as `npm run check:prompts`. Run --update DELIBERATELY when you intend to change a
// list, and commit the snapshot in the same change so the diff is reviewable.
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "lib/query-generator.ts");
const SNAP = path.join(ROOT, "scripts/prompts.snapshot.json");

// Auto-discover {vertical label → array const} from the PROMPTS_BY_VERTICAL map in source,
// so a newly-registered vertical can NEVER silently escape the lock (it would otherwise
// only be guarded if someone also remembered to edit this script).
function discoverVerticals(src) {
  const i = src.indexOf("PROMPTS_BY_VERTICAL");
  const block = src.slice(i, src.indexOf("};", i));
  const map = {};
  for (const m of block.matchAll(/"([^"]+)":\s*([A-Z0-9_]+)/g)) map[m[1]] = m[2];
  if (!Object.keys(map).length) throw new Error("could not parse PROMPTS_BY_VERTICAL");
  return map;
}
const VERTICALS = discoverVerticals(fs.readFileSync(SRC, "utf8"));

function block(src, constName) {
  const start = src.indexOf("const " + constName);
  if (start < 0) throw new Error(`array ${constName} not found in query-generator.ts`);
  const end = src.indexOf("\n];", start);
  if (end < 0) throw new Error(`array ${constName} not terminated`);
  return src.slice(start, end + 3);
}

function fingerprint() {
  const src = fs.readFileSync(SRC, "utf8");
  const out = {};
  for (const [vertical, constName] of Object.entries(VERTICALS)) {
    const b = block(src, constName);
    const texts = [...b.matchAll(/text: "([^"]+)"/g)].map((m) => m[1]);
    // Hash the whole normalized block, so ANY field change (category/intent/priority/
    // service/geo), not just text, trips the guard.
    const norm = b.replace(/\s+/g, " ").trim();
    out[vertical] = { count: texts.length, hash: crypto.createHash("sha256").update(norm).digest("hex").slice(0, 16), texts };
  }
  return out;
}

const update = process.argv.includes("--update");
const current = fingerprint();

if (update || !fs.existsSync(SNAP)) {
  fs.writeFileSync(SNAP, JSON.stringify(current, null, 2) + "\n");
  console.log(`${update ? "Updated" : "Created"} snapshot for ${Object.keys(current).length} verticals:`);
  for (const [v, d] of Object.entries(current)) console.log(`  ${v}: ${d.count} prompts (${d.hash})`);
  process.exit(0);
}

const snap = JSON.parse(fs.readFileSync(SNAP, "utf8"));
let drift = false;
const verts = new Set([...Object.keys(snap), ...Object.keys(current)]);
for (const v of verts) {
  const a = snap[v], b = current[v];
  if (!a) { console.error(`✗ ${v}: NEW vertical not in snapshot — run --update`); drift = true; continue; }
  if (!b) { console.error(`✗ ${v}: REMOVED from code but still in snapshot`); drift = true; continue; }
  if (a.hash === b.hash && a.count === b.count) { console.log(`✓ ${v}: ${b.count} prompts (${b.hash})`); continue; }
  drift = true;
  console.error(`✗ ${v}: DRIFT — snapshot ${a.count} prompts (${a.hash}) vs code ${b.count} (${b.hash})`);
  const added = b.texts.filter((t) => !a.texts.includes(t));
  const removed = a.texts.filter((t) => !b.texts.includes(t));
  for (const t of removed) console.error(`    - ${t}`);
  for (const t of added) console.error(`    + ${t}`);
  if (!added.length && !removed.length) console.error(`    (same texts — a non-text field changed: category/intent/priority/service/geo)`);
}
if (drift) { console.error("\nPrompt sets changed. If intentional, re-run with --update and commit scripts/prompts.snapshot.json."); process.exit(1); }
console.log("\nAll vertical prompt sets match the lock.");
