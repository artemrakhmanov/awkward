// One scenario run: actors, the board, the merged timeline, evidence, evals, and the files it writes.
//   e2e-runs/<run_id>/run.json    everything, machine-readable
//   e2e-runs/<run_id>/report.md   the same, readable and pasteable for another agent to verify
//   e2e-runs/<run_id>/shots/*.png screenshots of /r and /e
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Actor, type Door, type ToolCall, type Turn } from "./actor";
import { boardSnapshot, cleanup, cleanupId, type Http, lastLogId, type LogRow, logSince } from "./api";
import { BASE, MODEL, since, TEST_PREFIX } from "./env";
import { Screens, type Shot } from "./humans";

export type Status = "pass" | "fail" | "error" | "skipped";
export type Evidence = { label: string; kind: "log" | "http" | "transcript" | "snapshot" | "shot" | "judge" | "note"; content: string };
export type Eval = { id: string; name: string; status: Status; judge: string; why: string; evidence: Evidence[]; ms?: number };
export type Event = {
  i: number;
  t: number;
  from: string;
  to: string;
  kind: "prompt" | "reply" | "tool" | "server" | "human" | "snapshot" | "script";
  label: string;
  status?: string | number;
  source: "agent" | "server" | "script";
  detail?: unknown;
};
export type Post = { actor: string; human_link: string; human_token: string; agent_token: string | null; request_id: string | null };

export const RUNS_DIR = join(process.cwd(), "e2e-runs");

export class Run {
  readonly t0 = Date.now();
  readonly id: string;
  readonly dir: string;
  readonly board: { url: string; slug: string | null; title: string };
  actors: Record<string, Actor> = {};
  screens: Screens;
  events: Event[] = [];
  snapshots: { step: string; t: number; status: number; board: unknown }[] = [];
  posts: Post[] = [];
  http: { label: string; t: number; res: Http }[] = [];
  logRows: LogRow[] = [];
  evals: Eval[] = [];
  notes: string[] = [];
  startLogId = 0;
  finishedAt = 0;
  cleanup: unknown = null;
  strays: string[] = []; // ids of extra boards an agent created during the run

  constructor(
    public scenario: { id: string; name: string; summary: string },
    board: { slug?: string; title: string },
  ) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    this.id = `${stamp}Z-${scenario.id}-${Math.random().toString(36).slice(2, 6)}`;
    this.dir = join(RUNS_DIR, this.id);
    this.board = { url: `${TEST_PREFIX}e2e-${this.id.toLowerCase()}`, slug: board.slug ?? null, title: board.title };
    this.screens = new Screens(join(this.dir, "shots"), () => this.since());
  }

  since = () => since(this.t0);

  async start() {
    this.startLogId = await lastLogId();
  }

  actor(id: string, role: string, door: Door) {
    return (this.actors[id] = new Actor(id, role, door, this.t0, { run_id: this.id, scenario: this.scenario.id }));
  }

  event(e: Omit<Event, "i" | "t"> & { t?: number }) {
    this.events.push({ i: 0, t: this.since(), ...e });
  }

  note(s: string) {
    this.notes.push(s);
  }

  // A user turn to one agent, recorded as prompt → tool calls → reply. New post results are picked up.
  async say(actorId: string, step: string, prompt: string): Promise<Turn> {
    const a = this.actors[actorId];
    this.event({ from: `human${actorId}`, to: actorId, kind: "prompt", label: `step ${step}: ${short(prompt, 80)}`, source: "script", detail: { prompt } });
    const turn = await a.say(step, prompt);
    turn.calls.forEach((c, k) =>
      this.event({
        t: turn.t + (k + 1) * 0.01,
        from: actorId,
        to: "awkward",
        kind: "tool",
        label: callLabel(c),
        status: callStatus(c),
        source: "agent",
        detail: c,
      }),
    );
    this.event({
      from: actorId,
      to: `human${actorId}`,
      kind: "reply",
      label: turn.error ? `turn error: ${short(turn.error, 60)}` : short(turn.reply, 80),
      status: turn.error ? "error" : "ok",
      source: "agent",
      detail: { reply: turn.reply, ms: turn.ms, attempts: turn.attempts, error: turn.error },
    });
    for (const p of postsIn(turn.calls)) {
      if (!this.posts.some((x) => x.human_token === p.human_token)) this.posts.push({ actor: actorId, ...p });
    }
    return turn;
  }

  postsBy(actorId: string) {
    return this.posts.filter((p) => p.actor === actorId);
  }

  // The posts whose link the agent actually gave its human (newest first): that's what the human can open.
  relayed(actorId: string) {
    const replies = this.actors[actorId]?.turns.map((t) => t.reply).join("\n") ?? "";
    const mine = this.postsBy(actorId);
    const given = mine.filter((p) => replies.includes(p.human_token)).reverse();
    return given.length ? given : [...mine].reverse();
  }

  async snapshot(step: string) {
    const res = await boardSnapshot(this.board.url);
    this.snapshots.push({ step, t: this.since(), status: res.status, board: res.body });
    const slug = (res.body as { anchor?: { slug?: string } })?.anchor?.slug;
    if (slug) this.board.slug = slug;
    let shot: Shot | null = null;
    if (slug) shot = await this.screens.board(slug, `board-${step}`).catch(() => null);
    this.event({ from: "script", to: "board", kind: "snapshot", label: `board after step ${step}`, status: res.status, source: "script", detail: { snapshot: this.snapshots.length - 1, shot: shot?.file } });
    return res;
  }

  record(label: string, res: Http) {
    this.http.push({ label, t: this.since(), res });
    return res;
  }

  // Pulls the server log rows that belong to this run: by the run's token refs, or by the board URL/slug.
  async pullLog() {
    const refs = new Map<string, string>();
    for (const p of this.posts) {
      refs.set(ref(p.human_token), `human${p.actor}`);
      if (p.agent_token) refs.set(ref(p.agent_token), p.actor);
    }
    const all = await logSince(this.startLogId);
    const doors = Object.values(this.actors);
    const onBoard = (r: LogRow) => {
      const body = JSON.stringify(r.body ?? "");
      return body.includes(this.board.url) || (!!this.board.slug && body.includes(this.board.slug));
    };
    // Agents may never print their agent_token. Their post row is on this board and carries the token's
    // req_ref, so learn it there, then attribute that agent's later calls (inbox, close) by it.
    for (const r of all) {
      const isPost = /\/api\/requests$|post_request/.test(r.route) && r.result === "ok";
      if (isPost && r.req_ref && !refs.has(r.req_ref) && onBoard(r) && !/^node|undici/i.test(r.user_agent ?? "")) {
        const who = whoByDoor(r, doors);
        if (this.actors[who]) refs.set(r.req_ref, who);
      }
    }
    const mine = all.filter((r) => (r.req_ref && refs.has(r.req_ref)) || onBoard(r));
    for (const r of mine) {
      const isScript = !!r.user_agent && /^node|undici/i.test(r.user_agent);
      const who = isScript ? "script" : (r.req_ref && refs.get(r.req_ref)) || whoByDoor(r, doors);
      (r as LogRow & { actor?: string }).actor = who;
      this.event({
        t: Math.round((Date.parse(r.at) - this.t0) / 100) / 10,
        from: who,
        to: "awkward",
        kind: "server",
        label: `${r.door} ${r.route}`,
        status: r.result,
        source: "server",
        detail: r,
      });
    }
    this.logRows = mine;
  }

  rowsOf(actor: string) {
    return this.logRows.filter((r) => (r as LogRow & { actor?: string }).actor === actor);
  }

  async finish(keep: boolean) {
    await Promise.all(Object.values(this.actors).map((a) => a.stop()));
    if (!keep) {
      const main = (await cleanup(this.board.url)).body;
      const extra = await Promise.all(this.strays.map(async (id) => ({ id, res: (await cleanupId(id)).body })));
      this.cleanup = extra.length ? { board: main, strays: extra } : main;
    }
    this.finishedAt = Date.now();
    this.events.sort((a, b) => a.t - b.t).forEach((e, i) => (e.i = i));
    this.write();
  }

  counts() {
    const c = { pass: 0, fail: 0, error: 0, skipped: 0 };
    for (const e of this.evals) c[e.status]++;
    return c;
  }

  json() {
    return {
      run_id: this.id,
      scenario: this.scenario,
      mode: "full",
      started_at: new Date(this.t0).toISOString(),
      finished_at: new Date(this.finishedAt).toISOString(),
      base_url: BASE,
      git_sha: gitSha(),
      model: MODEL,
      board: this.board,
      actors: Object.values(this.actors).map((a) => ({ id: a.id, role: a.role, door: a.door, client: a.client, session_id: a.sessionId })),
      posts: this.posts,
      summary: this.counts(),
      evals: this.evals,
      events: this.events,
      transcripts: Object.fromEntries(Object.values(this.actors).map((a) => [a.id, a.turns])),
      board_snapshots: this.snapshots,
      screenshots: this.screens.shots,
      http: this.http,
      server_log: this.logRows,
      cleanup: this.cleanup,
      notes: this.notes,
    };
  }

  write() {
    mkdirSync(this.dir, { recursive: true });
    const data = this.json();
    writeFileSync(join(this.dir, "run.json"), JSON.stringify(data, null, 2));
    writeFileSync(join(this.dir, "report.md"), report(data));
    const indexFile = join(RUNS_DIR, "index.json");
    let index: unknown[] = [];
    try {
      index = JSON.parse(readFileSync(indexFile, "utf8"));
    } catch {}
    index = [
      { run_id: this.id, scenario: this.scenario.id, started_at: data.started_at, model: MODEL, ...data.summary, evals: Object.fromEntries(this.evals.map((e) => [e.id, e.status])) },
      ...index.filter((x) => (x as { run_id: string }).run_id !== this.id),
    ];
    writeFileSync(indexFile, JSON.stringify(index, null, 2));
  }
}

// ---- helpers

import { createHash } from "node:crypto";
export const ref = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 8);

export function short(s: string, n: number) {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

// Tool output as plain text with JSON escapes undone, so links and tokens can be found in it.
export function flat(v: unknown): string {
  let s = typeof v === "string" ? v : JSON.stringify(v ?? "");
  for (let k = 0; k < 3 && s.includes('\\"'); k++) s = s.replace(/\\\\/g, "\\").replace(/\\"/g, '"');
  return s;
}

const LINK_RE = /https?:\/\/[^\s"'<>)\]]*\/r\/([A-Za-z0-9_-]{43})/g;
// Finds new posts in an agent's tool outputs. Agents print responses in their own formats
// (raw JSON, MCP envelopes, "TELL_YOUR_HUMAN: …"), so this looks for the link and token anywhere.
function postsIn(calls: ToolCall[]): Omit<Post, "actor">[] {
  const out: Omit<Post, "actor">[] = [];
  for (const c of calls) {
    const text = flat(c.output);
    if (!/human_link|tell_your_human|private link/i.test(text)) continue;
    for (const m of text.matchAll(LINK_RE)) {
      if (out.some((p) => p.human_token === m[1])) continue;
      out.push({
        human_link: m[0],
        human_token: m[1],
        agent_token: text.match(/agent_token\W{1,6}([A-Za-z0-9_-]{43})/i)?.[1] ?? null,
        request_id: text.match(/request_id\W{1,6}([0-9a-f-]{36})/i)?.[1] ?? null,
      });
    }
  }
  return out;
}

function callLabel(c: ToolCall) {
  if (c.kind === "mcp") return `mcp ${c.name}`;
  if (c.kind === "command") {
    const cmd = String(c.input ?? "");
    const method = cmd.match(/-X\s+(\w+)/)?.[1] ?? (/\s-d\s|--data/.test(cmd) ? "POST" : "GET");
    const path = cmd.match(/https?:\/\/[^\s"']+/)?.[0]?.replace(BASE, "") ?? "";
    return /curl|wget|python|node/.test(cmd) && path ? `${method} ${short(path, 60)}` : `shell: ${short(cmd, 60)}`;
  }
  return `${c.kind} ${c.name}`;
}

function callStatus(c: ToolCall): string {
  if (c.error) return typeof c.error === "string" ? c.error : "error";
  const code = flat(c.output).match(/"error"\s*:\s*"([a-z_]+)"/)?.[1];
  return code ?? c.status ?? "ok";
}

function whoByDoor(r: LogRow, actors: Actor[]) {
  if (r.door === "human") return "browser";
  if (r.user_agent && /^node|undici/i.test(r.user_agent)) return "script";
  const door = r.door === "doc" ? "http" : r.door;
  const match = actors.filter((a) => a.door === door);
  return match.length === 1 ? match[0].id : door;
}

function gitSha() {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
}

// ---- report.md

const fence = (s: string, lang = "") => `\`\`\`${lang}\n${s.replace(/```/g, "ˋˋˋ")}\n\`\`\``;
const clip = (s: string | undefined | null, n = 6000) => (s ?? "").length > n ? `${(s ?? "").slice(0, n)}\n… (${(s ?? "").length - n} more chars in run.json)` : (s ?? "");
const pretty = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));
const MARK: Record<Status, string> = { pass: "PASS", fail: "FAIL", error: "ERROR", skipped: "SKIP" };

function report(d: ReturnType<Run["json"]>): string {
  const L: string[] = [];
  L.push(`# E2E run ${d.run_id}`, "");
  L.push(`**Scenario ${d.scenario.id}: ${d.scenario.name}.** ${d.scenario.summary}`, "");
  L.push(
    `| | |\n|---|---|\n| Result | ${d.summary.pass} pass, ${d.summary.fail} fail, ${d.summary.error} error, ${d.summary.skipped} skipped |` +
      `\n| Started | ${d.started_at} |\n| Finished | ${d.finished_at} |\n| Base | ${d.base_url} |\n| Git | ${d.git_sha ?? "?"} |\n| Model | ${d.model} |` +
      `\n| Board | ${d.board.url} (slug ${d.board.slug ?? "none"}) |` +
      `\n| Actors | ${d.actors.map((a) => `${a.id} = ${a.role} via ${a.door.toUpperCase()} (${a.client}), session \`${a.session_id}\``).join("; ")} |` +
      `\n| Cleanup | ${d.cleanup ? JSON.stringify(d.cleanup) : "kept (--keep)"} |`,
    "",
  );
  L.push("How to verify: every eval below quotes its evidence verbatim (server log rows, API responses, agent transcripts, board snapshots). The full data is in `run.json` next to this file; screenshots are in `shots/`.", "");

  L.push("## Evals", "", "| ID | Eval | Result | Judge | Why |", "|---|---|---|---|---|");
  for (const e of d.evals) L.push(`| ${e.id} | ${e.name} | **${MARK[e.status]}** | ${e.judge} | ${e.why.replace(/\|/g, "\\|").replace(/\n/g, " ")} |`);
  L.push("");

  L.push("## Evidence", "");
  for (const e of d.evals) {
    L.push(`### ${e.id} ${e.name}: ${MARK[e.status]}`, "", e.why, "");
    for (const ev of e.evidence) {
      L.push(`**${ev.label}** (${ev.kind})`, "");
      if (ev.kind === "shot") L.push(`![${ev.label}](${ev.content})`, "");
      else L.push(fence(clip(ev.content, 3000)), "");
    }
  }

  L.push("## Timeline", "", "| # | t (s) | From → To | What | Status | Source |", "|---|---|---|---|---|---|");
  for (const e of d.events) L.push(`| ${e.i} | ${e.t} | ${e.from} → ${e.to} | ${e.label.replace(/\|/g, "\\|")} | ${e.status ?? ""} | ${e.source} |`);
  L.push("");

  L.push("## Transcripts", "");
  for (const [id, turns] of Object.entries(d.transcripts)) {
    L.push(`### Agent ${id}`, "");
    for (const t of turns as Turn[]) {
      L.push(`#### Step ${t.step} (t=${t.t}s, ${Math.round(t.ms / 1000)}s, attempts ${t.attempts}${t.error ? `, error: ${t.error}` : ""})`, "");
      L.push("**Human said:**", "", fence(t.prompt), "");
      t.calls.forEach((c, k) => {
        L.push(`**Tool call ${k + 1}: ${c.kind} ${c.name}** (${c.status ?? ""}${c.error ? `, ${pretty(c.error)}` : ""})`, "");
        L.push("Input:", "", fence(clip(pretty(c.input), 3000)), "", "Output:", "", fence(clip(flat(c.output), 4000)), "");
      });
      L.push("**Agent replied:**", "", fence(t.reply || "(empty)"), "");
    }
  }

  L.push("## Board snapshots (GET /api/board)", "");
  for (const s of d.board_snapshots) L.push(`### After step ${s.step} (t=${s.t}s, HTTP ${s.status})`, "", fence(clip(pretty(s.board)), "json"), "");

  L.push("## Screenshots", "");
  for (const s of d.screenshots) L.push(`### ${s.name} (t=${s.t}s) ${s.url}`, "", `![${s.name}](${s.file})`, "", "Page text:", "", fence(clip(s.text ?? "", 1500)), "");

  if (d.http.length) {
    L.push("## Script API calls", "");
    for (const h of d.http) L.push(`### ${h.label} (t=${h.t}s, HTTP ${h.res.status})`, "", fence(clip(pretty(h.res.body)), "json"), "");
  }

  L.push("## Server log rows for this run", "", fence(clip(d.server_log.map((r) => JSON.stringify(r)).join("\n"), 20000), "jsonl"), "");
  if (d.notes.length) L.push("## Notes", "", ...d.notes.map((n) => `- ${n}`), "");
  return L.join("\n");
}
