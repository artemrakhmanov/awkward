// E2E runner: real cloud agents (OpenAI Agents API) against prod, one fresh test board per scenario.
//   npm run e2e                 all scenarios in parallel
//   npm run e2e -- s1 s3        just these
//   npm run e2e -- --keep       keep the boards (skip cleanup)
// Writes e2e-runs/<run_id>/{run.json,report.md,shots/} and e2e-runs/index.json.
import { BASE, MODEL, TRIAL_KEY } from "./lib/env";
import { closeBrowser } from "./lib/humans";
import { Run } from "./lib/run";
import { type Scenario, SCENARIOS } from "./scenarios";

async function runOne(s: Scenario, keep: boolean) {
  const r = new Run(s, { title: s.board.title });
  const ctx = { inbox: {}, rawPages: [] };
  await r.start();
  try {
    await s.run(r, ctx);
  } catch (e) {
    r.note(`Scenario stopped early: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  }
  try {
    await r.pullLog();
  } catch (e) {
    r.note(`Server log not read: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    r.evals = await s.evals(r, ctx);
  } catch (e) {
    r.evals.push({ id: "X", name: "Evals crashed", status: "error", judge: "script", why: e instanceof Error ? e.message : String(e), evidence: [] });
  }
  await r.finish(keep);
  const c = r.counts();
  const lines = [`\n== ${s.id} ${s.name}: ${c.pass} pass, ${c.fail} fail, ${c.error} error  →  ${r.dir}/report.md`];
  for (const e of r.evals) lines.push(`  ${e.status.toUpperCase().padEnd(5)} ${e.id.padEnd(6)} ${e.name}: ${e.why.slice(0, 160)}`);
  console.log(lines.join("\n"));
  return c;
}

async function main() {
  if (!TRIAL_KEY) throw new Error("TRIAL_KEY is required (reads the server log and cleans up).");
  const args = process.argv.slice(2);
  const keep = args.includes("--keep");
  const ids = args.filter((a) => !a.startsWith("--"));
  const chosen = ids.length ? SCENARIOS.filter((s) => ids.includes(s.id)) : SCENARIOS;
  console.log(`e2e against ${BASE} with ${MODEL}: ${chosen.map((s) => s.id).join(", ")}${keep ? " (keeping boards)" : ""}`);
  const results = await Promise.all(chosen.map((s) => runOne(s, keep)));
  await closeBrowser();
  const total = results.reduce((a, c) => ({ pass: a.pass + c.pass, fail: a.fail + c.fail, error: a.error + c.error }), { pass: 0, fail: 0, error: 0 });
  console.log(`\nTotal: ${total.pass} pass, ${total.fail} fail, ${total.error} error`);
  process.exit(total.fail || total.error ? 1 : 0);
}

main();
