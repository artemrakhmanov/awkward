import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type CSSProperties, Suspense } from "react";
import { RunView } from "@/components/evals/run-view";
import { doors, duration, Score, when } from "@/components/evals/status";
import { type EvalIndex, runPath } from "@/components/evals/types";
import data from "../../../../public/evals/index.json";

const index = data as EvalIndex;
const find = (id: string) => index.runs.find((r) => r.run_id === id);
const i = (n: number) => ({ "--i": n }) as CSSProperties;
type Props = { params: Promise<{ run: string }> };

export function generateStaticParams() {
  return index.runs.map((r) => ({ run: r.run_id }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { run } = await props.params;
  const r = find(run);
  if (!r) return { title: "Evals · Awkward" };
  return {
    title: `${r.scenario.name} · Evals · Awkward`,
    description: `${r.summary.pass}/${r.evals.length} checks passed. ${r.scenario.summary}`,
    alternates: { types: { "text/markdown": `${runPath(r.run_id)}/report.md`, "application/json": `${runPath(r.run_id)}/run.json` } },
  };
}

export default function Page(props: Props) {
  return (
    <main className="flex min-h-dvh flex-col gap-12 p-4 pb-24 text-[22px] leading-[1.3] tracking-[-0.01em] sm:text-2xl xl:px-5">
      <header className="rise flex gap-2 text-base" style={i(0)}>
        <Link href="/" className="font-semibold">
          awkward
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link href="/evals" className="font-semibold">
          Evals
        </Link>
      </header>
      <Suspense fallback={<p className="text-base text-muted-foreground">Loading…</p>}>
        <Run params={props.params} />
      </Suspense>
    </main>
  );
}

async function Run({ params }: { params: Promise<{ run: string }> }) {
  const { run } = await params;
  const r = find(run);
  if (!r) notFound();
  return (
    <>
      <section className="flex max-w-[48rem] flex-col gap-4">
        <p className="rise font-mono text-[13px] text-muted-foreground uppercase" style={i(1)}>
          Scenario {r.scenario.id}
        </p>
        <h1 className="rise font-semibold" style={i(1)}>
          {r.scenario.name}
        </h1>
        <p className="rise text-muted-foreground" style={i(2)}>
          {r.scenario.summary}
        </p>
        <p className="rise text-4xl font-semibold tracking-[-0.02em] sm:text-5xl" style={i(3)}>
          <span className="hl">
            <Score pass={r.summary.pass} total={r.evals.length} />
          </span>{" "}
          checks passed
        </p>
        <p className="rise text-[13px] text-muted-foreground" style={i(3)}>
          {when(r.started_at)} · {duration(r.seconds)} · {r.model} · {doors(r.actors)} · git {r.git_sha ?? "?"} ·{" "}
          <a href={`${runPath(r.run_id)}/report.md`} className="underline underline-offset-2 hover:text-foreground">
            report.md
          </a>
        </p>
      </section>
      <RunView id={r.run_id} />
    </>
  );
}
