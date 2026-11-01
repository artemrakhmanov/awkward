"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shotName, StatusDot } from "./status";
import { type RunEval, type RunFile, runPath, type Shot, type TimelineEvent, type ToolCall } from "./types";

// The run as a sequence diagram (Mermaid). Mermaid can't attach clicks to sequence arrows, so after it
// draws, each arrow is wired by its index to the event it came from. Clicking opens the step's details.

type Step = TimelineEvent & { detail?: unknown };

const LANES: { key: string; label: (run: RunFile) => string }[] = [
  { key: "humanA", label: () => "Human A" },
  { key: "A", label: (r) => `Agent A (${door(r, "A")})` },
  { key: "awkward", label: () => "Awkward" },
  { key: "board", label: () => "Board" },
  { key: "B", label: (r) => `Agent B (${door(r, "B")})` },
  { key: "humanB", label: () => "Human B" },
];
const door = (r: RunFile, id: string) => r.actors.find((a) => a.id === id)?.door.toUpperCase() ?? "";
const lane = (k: string) => (k === "script" ? "awkward" : k);
const SHOWN = new Set(["prompt", "tool", "reply", "human", "snapshot"]);

// Mermaid message text: no line breaks, semicolons, hashes or angle brackets; short.
const safe = (s: string, n = 46) => {
  const one = s.replace(/[\n\r;#<>{}]+/g, " ").replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
};

// Test-board URLs are long and the same everywhere in a run: show them as <board>.
const short = (s: string) => s.replace(/https?:\/\/test\.awkwardboard\.com\/[\w.-]+/g, "<board>").replace(/https?:\/\/awkwardboard\.com/g, "");

// A shell command, named by the Awkward call it makes (agents use curl, Python or Node).
function commandLabel(e: Step) {
  const cmd = text((e.detail as ToolCall | undefined)?.input ?? e.label);
  const paths = [...cmd.matchAll(/awkwardboard\.com(\/[^\s'"\\)]*)/g)].map((m) => m[1]);
  const path = paths.find((p) => /^\/(api|agents\.md|llms\.txt|r\/)/.test(p));
  if (!path) return null;
  const post = /-X\s*POST|method\s*=\s*['"]POST|--data|\s-d\s|requests\.post|data\s*=\s*(json\.dumps|b['"]|payload|body)/.test(cmd);
  return `${post ? "POST" : "GET"} ${short(path)}`;
}

function arrow(e: Step) {
  if (e.kind === "prompt") return { from: e.from, to: e.to, kind: "->>", text: safe(short(e.label.replace(/^step \S+: /, ""))) };
  if (e.kind === "reply") return { from: e.from, to: e.to, kind: "-->>", text: safe(short(e.label)) };
  if (e.kind === "snapshot") return { from: "awkward", to: "board", kind: "-)", text: safe(e.label) };
  if (e.kind === "human") return { from: e.from, to: "awkward", kind: "->>", text: safe(`${e.label} → ${e.status ?? ""}`) };
  const status = e.status && e.status !== "completed" && e.status !== "ok" ? ` → ${e.status}` : "";
  const label = e.label.startsWith("mcp ") ? `MCP ${e.label.slice(4)}` : (commandLabel(e) ?? short(e.label));
  return { from: e.from, to: "awkward", kind: "->>", text: safe(`${label}${status}`) };
}

function diagram(run: RunFile, steps: Step[]) {
  const used = new Set(steps.flatMap((s) => [lane(arrow(s).from), lane(arrow(s).to)]));
  const lines = ["sequenceDiagram"];
  for (const l of LANES) if (used.has(l.key)) lines.push(`  participant ${l.key} as ${l.label(run)}`);
  let lastStep = "";
  for (const s of steps) {
    const step = s.kind === "prompt" ? s.label.match(/^step (\S+):/)?.[1] : null;
    if (step && step !== lastStep) {
      lines.push(`  Note over ${lane(s.from)},${lane(s.to)}: Step ${step}`);
      lastStep = step;
    }
    const a = arrow(s);
    lines.push(`  ${lane(a.from)}${a.kind}${lane(a.to)}: ${a.text || " "}`);
  }
  return lines.join("\n");
}

const text = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2) ?? "");
const clip = (s: string, n = 6000) => (s.length > n ? `${s.slice(0, n)}\n… ${s.length - n} more characters in run.json` : s);
function inner(s: string) {
  const m = s.match(/"text":\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return s;
  try {
    const t = JSON.parse(`"${m[1]}"`);
    try {
      return JSON.stringify(JSON.parse(t), null, 2);
    } catch {
      return t;
    }
  } catch {
    return s;
  }
}

export function Flow({ run }: { run: RunFile }) {
  const steps = useMemo(() => (run.events as Step[]).filter((e) => SHOWN.has(e.kind)), [run]);
  const def = useMemo(() => diagram(run, steps), [run, steps]);
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          fontFamily: "var(--font-body), ui-sans-serif, system-ui",
          themeVariables: {
            primaryColor: "#f4efec",
            primaryBorderColor: "#e1d5cd",
            primaryTextColor: "#1f2322",
            lineColor: "#585254",
            noteBkgColor: "#ffffff",
            noteBorderColor: "#e1d5cd",
            noteTextColor: "#585254",
            actorBkg: "#f4efec",
            actorBorder: "#e1d5cd",
            actorTextColor: "#1f2322",
            signalColor: "#585254",
            signalTextColor: "#1f2322",
            fontSize: "14px",
          },
          sequence: { mirrorActors: true, useMaxWidth: true, messageMargin: 26, boxMargin: 8, noteMargin: 8, actorMargin: 40, width: 130 },
        });
        const { svg } = await mermaid.render(`flow-${run.run_id.replace(/[^a-zA-Z0-9]/g, "")}`, def);
        if (!alive || !box.current) return;
        box.current.innerHTML = svg;
        wire(box.current, setOpen);
      } catch (e) {
        console.error("flow diagram failed", e);
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [def, run.run_id]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-muted-foreground">
        Every arrow is a step. Click one for the details and what was on screen at that moment; use the arrow keys to walk
        through the run.
      </p>
      {failed ? (
        <pre className="overflow-x-auto rounded-2xl bg-secondary px-5 py-4 font-mono text-[13px]">{def}</pre>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <div ref={box} className="flow min-h-40 min-w-[56rem] [&_line.flow-hot]:stroke-[#ed313e]! [&_path.flow-hot]:stroke-[#ed313e]! [&_svg]:h-auto [&_svg]:w-full [&_text.flow-hot]:fill-[#ed313e]!" aria-label="Sequence diagram of the run" />
        </div>
      )}
      <AnimatePresence>
        {open !== null && steps[open] && (
          <StepModal key="modal" run={run} steps={steps} index={open} onClose={() => setOpen(null)} onGo={setOpen} />
        )}
      </AnimatePresence>
    </div>
  );
}

// Messages render in source order: the n-th .messageText and the n-th message line are the n-th arrow.
function wire(root: HTMLElement, open: (n: number) => void) {
  const texts = [...root.querySelectorAll<SVGTextElement>("text.messageText")];
  const lines = [...root.querySelectorAll<SVGElement>(".messageLine0, .messageLine1")];
  texts.forEach((t, n) => {
    const targets = [t, lines[n]].filter(Boolean) as SVGElement[];
    for (const el of targets) {
      el.style.cursor = "pointer";
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.addEventListener("click", () => open(n));
      el.addEventListener("keydown", (ev) => {
        if ((ev as KeyboardEvent).key === "Enter") open(n);
      });
      el.addEventListener("mouseenter", () => targets.forEach((x) => x.classList.add("flow-hot")));
      el.addEventListener("mouseleave", () => targets.forEach((x) => x.classList.remove("flow-hot")));
    }
    // A wide invisible hit area over the line, so it's easy to click.
    const line = lines[n] as SVGLineElement | undefined;
    if (line && line.tagName === "line") {
      const hit = line.cloneNode() as SVGLineElement;
      hit.removeAttribute("marker-end");
      hit.removeAttribute("class");
      hit.setAttribute("stroke", "transparent");
      hit.setAttribute("stroke-width", "16");
      hit.style.cursor = "pointer";
      hit.addEventListener("click", () => open(n));
      hit.addEventListener("mouseenter", () => targets.forEach((x) => x.classList.add("flow-hot")));
      hit.addEventListener("mouseleave", () => targets.forEach((x) => x.classList.remove("flow-hot")));
      line.parentNode?.insertBefore(hit, line.nextSibling);
    }
  });
}

// ---------------------------------------------------------------- modal

function shotAt(shots: Shot[], t: number) {
  const before = shots.filter((s) => s.t <= t + 2);
  return before[before.length - 1] ?? null;
}

// Checks whose quoted evidence contains this step's text (a reply, a prompt, a tool call, or this screenshot).
function relatedChecks(evals: RunEval[], s: Step, shot: Shot | null): RunEval[] {
  const d = (s.detail ?? {}) as { reply?: string; prompt?: string; input?: unknown; shot?: string };
  const needles = [d.reply, d.prompt, typeof d.input === "string" ? d.input : d.input ? JSON.stringify(d.input) : undefined]
    .filter((x): x is string => !!x && x.length > 12)
    .map((x) => x.slice(0, 80));
  const file = d.shot ?? (s.kind === "snapshot" || s.kind === "human" ? shot?.file : undefined);
  return evals.filter((e) => e.evidence.some((ev) => (file && ev.content === file) || needles.some((n) => ev.content.includes(n))));
}

function StepModal({ run, steps, index, onClose, onGo }: { run: RunFile; steps: Step[]; index: number; onClose: () => void; onGo: (n: number) => void }) {
  const s = steps[index];
  const d = (s.detail ?? {}) as Record<string, unknown>;
  const shotFile = typeof d.shot === "string" ? d.shot : null;
  const shot = shotFile ? (run.screenshots.find((x) => x.file === shotFile) ?? null) : shotAt(run.screenshots, s.t);
  const checks = relatedChecks(run.evals, s, shot);
  const snapshot = s.kind === "snapshot" && typeof d.snapshot === "number" ? run.board_snapshots[d.snapshot] : null;
  const go = useCallback((n: number) => n >= 0 && n < steps.length && onGo(n), [steps.length, onGo]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
      if (ev.key === "ArrowRight" || ev.key === "ArrowDown") go(index + 1);
      if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, onClose]);

  const who = (k: string) => LANES.find((l) => l.key === lane(k))?.label(run) ?? k;
  const a = arrow(s);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end bg-[#1f2322]/30"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label="Step details"
        className="flex h-full w-full max-w-[44rem] flex-col overflow-y-auto bg-background p-5 shadow-2xl sm:p-8"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground tabular-nums">
            {index + 1} of {steps.length} · {s.t}s
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="h-10 rounded-full bg-secondary px-4 text-base font-semibold disabled:opacity-40">
              ← Prev
            </button>
            <button type="button" onClick={() => go(index + 1)} disabled={index === steps.length - 1} className="h-10 rounded-full bg-secondary px-4 text-base font-semibold disabled:opacity-40">
              Next →
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className="h-10 w-10 rounded-full text-xl hover:bg-secondary">
              ×
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-muted-foreground">
            {who(a.from)} → {who(a.to)}
          </p>
          <h2 className="text-2xl leading-tight font-semibold">{headline(s)}</h2>
          {s.status !== undefined && <p className="text-base text-muted-foreground">Status: {String(s.status)}</p>}
        </div>

        <div className="mt-6 flex flex-col gap-6 text-base">
          <Body s={s} d={d} />

          {snapshot && (
            <Section label={`Board API after step ${snapshot.step} (GET /api/board)`}>
              <Pre>{text(snapshot.board)}</Pre>
            </Section>
          )}

          {shot && (
            <Section label={`On screen${shotFile ? "" : " at this moment"}: ${shotName(shot.name)} (${shot.t}s)`}>
              <a href={`${runPath(run.run_id)}/${shot.file}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${runPath(run.run_id)}/${shot.file}`} alt={shot.name} className="w-full" />
              </a>
            </Section>
          )}

          {checks.length > 0 && (
            <Section label="Checks that use this step as evidence">
              <ul className="flex flex-col gap-2">
                {checks.map((c) => (
                  <li key={c.id} className="flex items-start gap-3">
                    <StatusDot status={c.status} className="mt-1.5 size-2.5" />
                    <span>
                      <span className="mr-2 font-mono text-[13px] text-muted-foreground">{c.id}</span>
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-muted-foreground"> · {c.why}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </motion.aside>
    </motion.div>
  );
}

function headline(s: Step) {
  if (s.kind === "prompt") return "The human asks";
  if (s.kind === "reply") return "The agent replies";
  if (s.kind === "snapshot") return s.label.replace(/^board/, "Board");
  if (s.kind === "human") return s.label.replace(/^\w/, (c) => c.toUpperCase());
  return s.label;
}

function Body({ s, d }: { s: Step; d: Record<string, unknown> }) {
  if (s.kind === "prompt") return <Bubble dark>{String(d.prompt ?? s.label)}</Bubble>;
  if (s.kind === "reply")
    return (
      <>
        <Bubble>{String(d.error ? `Turn failed: ${d.error}` : (d.reply ?? s.label))}</Bubble>
        {typeof d.ms === "number" && <p className="text-[13px] text-muted-foreground">Turn took {Math.round(d.ms / 1000)}s</p>}
      </>
    );
  if (s.kind === "tool") {
    const c = d as unknown as ToolCall;
    return (
      <>
        <Section label={`Input · ${c.kind === "mcp" ? `MCP tool ${c.name}` : c.kind === "command" ? "shell command in the agent's sandbox" : c.kind}`}>
          <Pre>{text(c.input)}</Pre>
        </Section>
        <Section label={`Output${c.error ? ` · ${text(c.error)}` : ""}`}>
          <Pre>{inner(text(c.output))}</Pre>
        </Section>
      </>
    );
  }
  return null;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      {children}
    </section>
  );
}

function Bubble({ children, dark = false }: { children: string; dark?: boolean }) {
  return (
    <p className={`rounded-3xl px-5 py-3 leading-snug whitespace-pre-wrap ${dark ? "rounded-br-lg bg-foreground text-background" : "rounded-bl-lg bg-secondary"}`}>{children}</p>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl bg-secondary px-5 py-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words">{clip(children)}</pre>
  );
}
