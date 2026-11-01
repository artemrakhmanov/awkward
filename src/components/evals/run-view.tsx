"use client";

import { AnimatePresence, motion } from "motion/react";
import { type CSSProperties, type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { StatusDot, StatusPill } from "./status";
import { type RunEval, type RunFile, runPath, type Shot, type ToolCall } from "./types";

const TABS = [
  { key: "checks", name: "Checks" },
  { key: "conversation", name: "Conversation" },
  { key: "screens", name: "Screens" },
  { key: "timeline", name: "Timeline" },
  { key: "files", name: "Files" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("hashchange", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("hashchange", fn);
  };
}
const swap = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
};

const text = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2) ?? "");
const clip = (s: string, n = 5000) => (s.length > n ? `${s.slice(0, n)}\n… ${s.length - n} more characters in run.json` : s);

function Pre({ children, className = "" }: { children: string; className?: string }) {
  return (
    <pre className={`overflow-x-auto rounded-2xl bg-secondary px-5 py-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words ${className}`}>
      {clip(children)}
    </pre>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-muted-foreground">{children}</p>;
}

export function RunView({ id }: { id: string }) {
  const [run, setRun] = useState<RunFile | null>(null);
  const [failed, setFailed] = useState(false);
  const hash = useSyncExternalStore(subscribe, () => window.location.hash.slice(1), () => "");
  const active: Tab = TABS.some((t) => t.key === hash) ? (hash as Tab) : "checks";
  const pick = (k: Tab) => {
    window.history.replaceState(null, "", `#${k}`);
    listeners.forEach((fn) => fn());
  };

  useEffect(() => {
    fetch(`${runPath(id)}/run.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setRun)
      .catch(() => setFailed(true));
  }, [id]);

  if (failed) return <p className="text-base text-muted-foreground">Couldn&apos;t load this run.</p>;
  if (!run) return <p className="text-base text-muted-foreground">Loading the run…</p>;

  return (
    <div className="flex flex-col gap-10">
      <div role="tablist" aria-label="Run" className="rise -mx-4 flex items-center gap-1 overflow-x-auto px-4 sm:gap-2" style={{ "--i": 4 } as CSSProperties}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === active}
            onClick={() => pick(t.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-lg font-semibold transition-colors ${
              t.key === active ? "bg-secondary text-foreground" : "text-[var(--soot-200)] hover:text-foreground"
            }`}
          >
            {t.name}
            {t.key === "checks" && <span className="ml-1.5 tabular-nums">{run.evals.length}</span>}
            {t.key === "screens" && <span className="ml-1.5 tabular-nums">{run.screenshots.length}</span>}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={active} {...swap} role="tabpanel">
          {active === "checks" && <Checks run={run} />}
          {active === "conversation" && <Conversation run={run} />}
          {active === "screens" && <Screens id={id} shots={run.screenshots} />}
          {active === "timeline" && <Timeline run={run} />}
          {active === "files" && <Files id={id} run={run} />}
        </motion.div>
      </AnimatePresence>
      <Toaster position="bottom-center" />
    </div>
  );
}

// ---------------------------------------------------------------- Checks

function Checks({ run }: { run: RunFile }) {
  const id = run.run_id;
  return (
    <ul className="flex max-w-[60rem] flex-col gap-3">
      {run.evals.map((e) => (
        <li key={e.id}>
          <Check e={e} id={id} />
        </li>
      ))}
    </ul>
  );
}

function Check({ e, id }: { e: RunEval; id: string }) {
  return (
    <details className="group rounded-3xl border border-border open:bg-[var(--sand-100)]/40">
      <summary className="flex cursor-pointer list-none items-start gap-4 p-5 [&::-webkit-details-marker]:hidden">
        <StatusDot status={e.status} className="mt-2 size-3" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-lg leading-snug font-semibold">
            <span className="mr-2 font-mono text-[13px] font-normal text-muted-foreground">{e.id}</span>
            {e.name}
          </p>
          <p className="text-base leading-snug text-muted-foreground">{e.why}</p>
        </div>
        <span className="mt-1 hidden sm:block">
          <StatusPill status={e.status} />
        </span>
      </summary>
      <div className="flex flex-col gap-5 px-5 pb-5 sm:pl-12">
        <Label>Judged by {e.judge}</Label>
        {e.evidence.map((ev, k) => (
          <figure key={k} className="flex min-w-0 flex-col gap-2">
            <figcaption className="text-[13px] text-muted-foreground">{ev.label}</figcaption>
            {ev.kind === "shot" ? (
              <a href={`${runPath(id)}/${ev.content}`} target="_blank" rel="noreferrer" className="block max-w-xl overflow-hidden rounded-2xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${runPath(id)}/${ev.content}`} alt={ev.label} className="w-full" loading="lazy" />
              </a>
            ) : (
              <Pre>{ev.content}</Pre>
            )}
          </figure>
        ))}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- Conversation

function Conversation({ run }: { run: RunFile }) {
  const turns = Object.values(run.transcripts)
    .flat()
    .sort((a, b) => a.t - b.t);
  const actor = (id: string) => run.actors.find((a) => a.id === id);
  return (
    <ol className="flex max-w-[52rem] flex-col gap-10">
      {turns.map((t, k) => {
        const a = actor(t.actor);
        return (
          <li key={k} className="flex flex-col gap-3">
            <Label>
              Step {t.step} · {t.t}s · {a?.role}&apos;s agent ({a?.door.toUpperCase()}) · {Math.round(t.ms / 1000)}s
              {t.attempts > 1 ? ` · ${t.attempts} attempts` : ""}
            </Label>
            <div className="ml-auto max-w-[85%] rounded-3xl rounded-br-lg bg-foreground px-5 py-3 text-base leading-snug text-background">
              <p className="mb-1 text-[13px] opacity-70">Human {t.actor}</p>
              <p className="whitespace-pre-wrap">{t.prompt}</p>
            </div>
            {t.calls.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {t.calls.map((c, n) => (
                  <li key={n}>
                    <CallRow c={c} />
                  </li>
                ))}
              </ul>
            )}
            <div className="max-w-[85%] rounded-3xl rounded-bl-lg bg-secondary px-5 py-3 text-base leading-snug">
              <p className="mb-1 text-[13px] text-muted-foreground">
                Agent {t.actor} ({a?.role}, {a?.door.toUpperCase()})
              </p>
              <p className="whitespace-pre-wrap">{t.error ? `Turn failed: ${t.error}` : t.reply || "(no reply)"}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function callTitle(c: ToolCall) {
  if (c.kind === "mcp") return `MCP ${c.name}`;
  const cmd = text(c.input).replace(/^\/bin\/bash -lc\s+/, "").replace(/\s+/g, " ");
  return cmd.length > 110 ? `${cmd.slice(0, 109)}…` : cmd;
}

function CallRow({ c }: { c: ToolCall }) {
  // An error response starts with {"error": …}. (Docs the agent reads mention that shape, so don't search inside.)
  const failed = !!c.error || /^\s*\{\s*"error"\s*:/.test(unescape(text(c.output)));
  return (
    <details className="rounded-2xl border border-border">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${c.kind === "mcp" ? "bg-[var(--accent-teal)]/20" : "bg-secondary"}`}>
          {c.kind === "mcp" ? "mcp" : c.kind === "command" ? "shell" : c.kind}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{callTitle(c)}</span>
        {failed && <StatusDot status="fail" title="Returned an error" />}
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <Label>Input</Label>
        <Pre>{text(c.input)}</Pre>
        <Label>Output{c.error ? ` · ${text(c.error)}` : ""}</Label>
        <Pre>{unescape(text(c.output))}</Pre>
      </div>
    </details>
  );
}

// MCP outputs wrap JSON in JSON: show the inner text readably.
function unescape(s: string) {
  const m = s.match(/"text":\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return s;
  try {
    const inner = JSON.parse(`"${m[1]}"`);
    try {
      return JSON.stringify(JSON.parse(inner), null, 2);
    } catch {
      return inner;
    }
  } catch {
    return s;
  }
}

// ---------------------------------------------------------------- Screens

const WHO: Record<string, string> = { rider: "Rider", driver: "Driver", seller: "Seller" };
const WHAT: Record<string, string> = {
  inbox: "opens their link",
  form: "fills in what to share",
  "after-accept": "after accepting",
  "after-decline": "after declining",
  "no-match": "has nothing to accept",
  final: "at the end",
  "after-decline-final": "after the decline",
};
function shotName(name: string) {
  if (name === "driver-after-decline") return "Driver after the rider declined";
  const board = name.match(/^board-(.+)$/);
  if (board) return `Board after step ${board[1]}`;
  const [who, ...rest] = name.split("-");
  const what = rest.join("-");
  return `${WHO[who] ?? who} ${WHAT[what] ?? what.replace(/-/g, " ")}`;
}

function Screens({ id, shots }: { id: string; shots: Shot[] }) {
  if (!shots.length) return <p className="text-base text-muted-foreground">No screenshots in this run.</p>;
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {shots.map((s) => (
        <li key={s.file} className="flex min-w-0 flex-col gap-2">
          <a href={`${runPath(id)}/${s.file}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-border bg-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${runPath(id)}/${s.file}`} alt={shotName(s.name)} loading="lazy" className="aspect-[4/3] w-full object-cover object-top" />
          </a>
          <p className="text-base font-semibold">{shotName(s.name)}</p>
          <Label>
            {s.t}s · {s.url.replace(/^https?:\/\//, "")}
          </Label>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- Timeline

const SOURCES = ["all", "agent", "server", "script"] as const;

function Timeline({ run }: { run: RunFile }) {
  const [source, setSource] = useState<(typeof SOURCES)[number]>("all");
  const events = run.events.filter((e) => source === "all" || e.source === source);
  return (
    <div className="flex max-w-[64rem] flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {SOURCES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSource(s)}
            className={`rounded-full px-3 py-1 text-base font-semibold capitalize ${s === source ? "bg-secondary" : "text-[var(--soot-200)] hover:text-foreground"}`}
          >
            {s === "all" ? "Everything" : s === "agent" ? "What agents did" : s === "server" ? "What the server logged" : "Script and humans"}
          </button>
        ))}
      </div>
      <ol className="flex flex-col">
        {events.map((e) => (
          <li key={e.i} className="grid grid-cols-[3.5rem_minmax(0,9rem)_minmax(0,1fr)] items-baseline gap-3 border-b border-border py-2.5 text-base last:border-0 sm:grid-cols-[3.5rem_11rem_minmax(0,1fr)_auto]">
            <span className="font-mono text-[13px] text-muted-foreground tabular-nums">{e.t}s</span>
            <span className="truncate text-[13px] font-semibold">
              {e.from} → {e.to}
            </span>
            <span className="min-w-0 truncate">{e.label}</span>
            <span className="hidden text-[13px] text-muted-foreground sm:block">{e.status ?? ""}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- Files

function Files({ id, run }: { id: string; run: RunFile }) {
  const copy = async () => {
    try {
      const md = await (await fetch(`${runPath(id)}/report.md`)).text();
      await navigator.clipboard.writeText(md);
      toast("Report copied as markdown.");
    } catch {
      toast("Couldn't copy. Open report.md instead.");
    }
  };
  return (
    <div className="flex max-w-[52rem] flex-col gap-8">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={copy} className="h-12 rounded-full bg-foreground px-6 text-base font-semibold text-background">
          Copy report as markdown
        </button>
        <a href={`${runPath(id)}/report.md`} className="grid h-12 place-items-center rounded-full bg-secondary px-6 text-base font-semibold">
          report.md
        </a>
        <a href={`${runPath(id)}/run.json`} className="grid h-12 place-items-center rounded-full bg-secondary px-6 text-base font-semibold">
          run.json
        </a>
      </div>
      <p className="text-base text-muted-foreground">
        report.md quotes every piece of evidence (server log rows, API responses, agent transcripts, board snapshots), so another agent can check each verdict from it alone. run.json has everything, machine-readable.
      </p>
      <div className="flex flex-col gap-3">
        <Label>Agent sessions (OpenAI Agents API, kept for their traces)</Label>
        {run.actors.map((a) => (
          <p key={a.id} className="text-base">
            <span className="font-semibold">
              Agent {a.id}, {a.role}, {a.door.toUpperCase()}
            </span>{" "}
            <span className="font-mono text-[13px] break-all text-muted-foreground">{a.session_id ?? "not recorded"}</span>
          </p>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Label>Test board (deleted after the run)</Label>
        <p className="font-mono text-[13px] break-all">{run.board.url}</p>
        <Pre>{text(run.cleanup)}</Pre>
      </div>
      {run.notes.length > 0 && (
        <div className="flex flex-col gap-3">
          <Label>Notes</Label>
          {run.notes.map((n, k) => (
            <Pre key={k}>{n}</Pre>
          ))}
        </div>
      )}
    </div>
  );
}
