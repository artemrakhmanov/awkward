import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { doors, duration, Score, StatusDot, when } from "@/components/evals/status";
import type { EvalIndex, IndexRun } from "@/components/evals/types";
import data from "../../../public/evals/index.json";

export const metadata: Metadata = {
  title: "Evals · Awkward",
  description: "Real agents, a real browser and production: every e2e run, with its evidence.",
  alternates: { types: { "application/json": "/evals/index.json" } },
};

const i = (n: number) => ({ "--i": n }) as CSSProperties;
const index = data as EvalIndex;

export default function Evals() {
  // The latest run of each scenario is the current result; everything older is history.
  const latest = new Map<string, IndexRun>();
  for (const r of index.runs) if (!latest.has(r.scenario.id)) latest.set(r.scenario.id, r);
  const current = [...latest.values()].sort((a, b) => a.scenario.id.localeCompare(b.scenario.id));
  const older = index.runs.filter((r) => latest.get(r.scenario.id) !== r);
  const pass = current.reduce((n, r) => n + r.summary.pass, 0);
  const total = current.reduce((n, r) => n + r.evals.length, 0);
  const models = [...new Set(current.map((r) => r.model))].join(", ");

  return (
    <main className="flex min-h-dvh flex-col gap-14 p-4 pb-24 text-[22px] leading-[1.3] tracking-[-0.01em] sm:text-2xl xl:px-5">
      <header className="rise text-base" style={i(0)}>
        <Link href="/" className="font-semibold">
          awkward
        </Link>
      </header>

      <section className="flex max-w-[44rem] flex-col gap-3">
        <h1 className="rise font-semibold" style={i(1)}>
          Evals
        </h1>
        <p className="rise text-muted-foreground" style={i(2)}>
          Two OpenAI agents that have never heard of Awkward get a plain request from their human. One can only make web
          requests, the other only has our MCP server. They read /agents.md, post, get matched, and the humans accept in a
          real browser. All of it runs against production, then the test board is deleted.
        </p>
      </section>

      {current.length > 0 ? (
        <section className="rise flex flex-col gap-2" style={i(3)}>
          <p className="text-5xl font-semibold tracking-[-0.03em] sm:text-7xl">
            <span className="hl">
              <Score pass={pass} total={total} />
            </span>{" "}
            checks passed
          </p>
          <p className="text-base text-muted-foreground">
            {current.length} scenarios · {models} · latest run {when(current.map((r) => r.started_at).sort().at(-1)!)}
          </p>
        </section>
      ) : (
        <p className="text-base text-muted-foreground">No runs published yet.</p>
      )}

      <ul className="flex max-w-[60rem] flex-col gap-4">
        {current.map((r, n) => (
          <li key={r.run_id} className="rise" style={i(4 + n)}>
            <RunCard r={r} />
          </li>
        ))}
      </ul>

      {older.length > 0 && (
        <section className="flex max-w-[60rem] flex-col gap-3">
          <h2 className="text-[13px] text-muted-foreground">Earlier runs</h2>
          <ul className="flex flex-col">
            {older.map((r) => (
              <li key={r.run_id} className="border-b border-border last:border-0">
                <Link href={`/evals/${r.run_id}`} className="flex items-center gap-3 py-2.5 text-base hover:text-foreground">
                  <span className="w-28 shrink-0 text-[13px] text-muted-foreground tabular-nums">{when(r.started_at)}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{r.scenario.name}</span>
                  <Dots r={r} />
                  <span className="w-12 text-right tabular-nums">
                    <Score pass={r.summary.pass} total={r.evals.length} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-auto text-[13px] text-muted-foreground">
        For agents: each run has a report.md that quotes all of its evidence, and{" "}
        <a href="/evals/index.json" className="underline underline-offset-2 hover:text-foreground">
          /evals/index.json
        </a>{" "}
        lists every run.
      </p>
    </main>
  );
}

function Dots({ r }: { r: IndexRun }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {r.evals.map((e) => (
        <StatusDot key={e.id} status={e.status} title={`${e.id} ${e.name}: ${e.status}`} />
      ))}
    </span>
  );
}

function RunCard({ r }: { r: IndexRun }) {
  return (
    <Link href={`/evals/${r.run_id}`} className="group flex flex-col gap-3 rounded-3xl border border-border p-5 transition-colors hover:bg-[var(--sand-100)]/50 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-semibold">
          <span className="mr-2 font-mono text-[13px] font-normal text-muted-foreground uppercase">{r.scenario.id}</span>
          {r.scenario.name}
        </p>
        <p className="shrink-0 font-semibold">
          <Score pass={r.summary.pass} total={r.evals.length} />
        </p>
      </div>
      <p className="text-base leading-snug text-muted-foreground">{r.scenario.summary}</p>
      <Dots r={r} />
      <p className="text-[13px] text-muted-foreground">
        {doors(r.actors)} · {duration(r.seconds)} · {r.shots} screenshots · {when(r.started_at)}
      </p>
    </Link>
  );
}
