// Publishes e2e runs to the site: public/evals/runs/<id>/{run.json,report.md,shots/} and public/evals/index.json.
//   npm run e2e:publish                 the latest run of each scenario
//   npm run e2e:publish -- <run_id> …   these runs
// Refuses runs whose board was kept (--keep: their tokens still work) and anything holding a secret.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "e2e-runs");
const OUT = join(process.cwd(), "public", "evals");
const SECRETS = [process.env.TRIAL_KEY, process.env.OPENAI_API_KEY].filter((s): s is string => !!s && s.length > 8);

type RunJson = {
  run_id: string;
  scenario: { id: string; name: string; summary: string };
  started_at: string;
  finished_at: string;
  model: string;
  git_sha: string | null;
  board: { url: string; slug: string | null; title: string };
  actors: { id: string; role: string; door: string; client: string; session_id: string | null }[];
  summary: { pass: number; fail: number; error: number; skipped: number };
  evals: { id: string; name: string; status: string; why: string }[];
  screenshots: unknown[];
  cleanup: unknown;
};

function load(id: string): RunJson {
  return JSON.parse(readFileSync(join(SRC, id, "run.json"), "utf8"));
}

function pick(ids: string[]): string[] {
  if (ids.length) return ids;
  const all = readdirSync(SRC).filter((d) => existsSync(join(SRC, d, "run.json"))).sort().reverse();
  const latest = new Map<string, string>();
  for (const d of all) {
    const r = load(d);
    if (!latest.has(r.scenario.id) && r.cleanup) latest.set(r.scenario.id, d);
  }
  return [...latest.values()].sort((a, b) => load(a).scenario.id.localeCompare(load(b).scenario.id));
}

function entry(r: RunJson) {
  return {
    run_id: r.run_id,
    scenario: r.scenario,
    started_at: r.started_at,
    finished_at: r.finished_at,
    seconds: Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000),
    model: r.model,
    git_sha: r.git_sha,
    board_title: r.board.title,
    actors: r.actors.map(({ id, role, door, session_id }) => ({ id, role, door, session_id })),
    summary: r.summary,
    evals: r.evals.map(({ id, name, status, why }) => ({ id, name, status, why })),
    shots: r.screenshots.length,
  };
}

function main() {
  const ids = pick(process.argv.slice(2));
  if (!ids.length) throw new Error("No runs to publish in e2e-runs/.");
  mkdirSync(join(OUT, "runs"), { recursive: true });
  const indexFile = join(OUT, "index.json");
  const index: { published_at: string; runs: ReturnType<typeof entry>[] } = existsSync(indexFile)
    ? JSON.parse(readFileSync(indexFile, "utf8"))
    : { published_at: "", runs: [] };

  for (const id of ids) {
    const r = load(id);
    if (!r.cleanup) throw new Error(`${id}: board was kept (--keep), so its tokens still work. Not publishing.`);
    for (const f of ["run.json", "report.md"]) {
      const text = readFileSync(join(SRC, id, f), "utf8");
      if (SECRETS.some((s) => text.includes(s))) throw new Error(`${id}/${f} contains a secret. Not publishing.`);
    }
    cpSync(join(SRC, id), join(OUT, "runs", id), { recursive: true });
    index.runs = [entry(r), ...index.runs.filter((x) => x.run_id !== id)];
    console.log(`published ${id}: ${r.summary.pass} pass, ${r.summary.fail} fail, ${r.summary.error} error`);
  }
  index.runs.sort((a, b) => b.started_at.localeCompare(a.started_at));
  index.published_at = new Date().toISOString();
  writeFileSync(indexFile, JSON.stringify(index, null, 2));
  console.log(`${index.runs.length} run(s) in public/evals/index.json`);
}

main();
