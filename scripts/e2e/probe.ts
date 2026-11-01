// Checkpoint: both agents post once on a fresh test board, then the board is deleted.
//   npx tsx --env-file=.env.local scripts/e2e/probe.ts
import { Actor } from "./lib/actor";
import { BASE, MODEL, TEST_PREFIX, TRIAL_KEY } from "./lib/env";

const J = { "content-type": "application/json" };
const t0 = Date.now();
const board = `${TEST_PREFIX}e2e-probe-${Date.now().toString(36)}`;

async function main() {
const created = await (
  await fetch(`${BASE}/api/anchors`, {
    method: "POST",
    headers: J,
    body: JSON.stringify({ url: board, title: "Silverstone Half Marathon", starts_at: "2026-11-22", place: "Silverstone, Northamptonshire" }),
  })
).json();
console.log("board", board, "slug", created.slug, "model", MODEL);
if (!String(created.slug).startsWith("test-")) {
  console.log("slug fix not deployed yet, aborting");
  await cleanup();
  process.exit(1);
}


const A = new Actor("A", "rider", "http", t0);
const B = new Actor("B", "driver", "mcp", t0);
try {
  const [a, b] = await Promise.all([
    A.say("1", `Read ${BASE}/agents.md?url=${board} and post for me: I'm running the Silverstone Half on the 22nd and need a lift from east London.`),
    B.say("2", `Use Awkward to post for me on the board for ${board}: I'm driving from Hackney to the Silverstone Half on the 22nd, 2 spare seats, happy to split fuel.`),
  ]);
  for (const t of [a, b]) {
    console.log(`\n===== ${t.actor} (${Math.round(t.ms / 1000)}s, attempts ${t.attempts}${t.error ? `, ERROR ${t.error}` : ""})`);
    for (const c of t.calls) console.log(`-- ${c.kind} ${c.name} ${c.status ?? ""}\n   in:  ${JSON.stringify(c.input).slice(0, 400)}\n   out: ${JSON.stringify(c.output).slice(0, 400)}`);
    console.log(`-- reply:\n${t.reply}`);
  }
  console.log("\nboard now:", JSON.stringify(await (await fetch(`${BASE}/api/board/${encodeURIComponent(board)}`)).json()).slice(0, 800));
} finally {
  await Promise.all([A.stop(), B.stop()]);
  await cleanup();
}
}

main();

async function cleanup() {
  const r = await fetch(`${BASE}/api/trial/cleanup`, { method: "POST", headers: { ...J, authorization: `Bearer ${TRIAL_KEY}` }, body: JSON.stringify({ url: board }) });
  console.log("cleanup", r.status, await r.text());
}
