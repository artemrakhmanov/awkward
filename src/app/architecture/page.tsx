import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArchitectureTabs } from "@/components/architecture-tabs";

export const metadata: Metadata = {
  title: "Architecture · Awkward",
  description: "How Awkward works, one entity at a time.",
  alternates: { types: { "text/markdown": "/agents.md" } },
};

const i = (n: number) => ({ "--i": n }) as CSSProperties;

export default function Architecture() {
  return (
    <main className="flex min-h-dvh flex-col gap-14 p-4 pb-24 text-[22px] leading-[1.3] tracking-[-0.01em] sm:text-2xl xl:px-5">
      <header className="rise text-base" style={i(0)}>
        <Link href="/" className="font-semibold">
          awkward
        </Link>
      </header>

      <section className="flex max-w-[41rem] flex-col gap-3">
        <h1 className="rise font-semibold" style={i(1)}>
          Architecture
        </h1>
        <p className="rise text-muted-foreground" style={i(2)}>
          Five things, in the order they happen, and how they stay private. Examples are from a test board,
          with names, numbers and tokens made up.
        </p>
      </section>

      <div className="w-full max-w-[72rem]">
        <ArchitectureTabs />
      </div>

      <p className="rise mt-auto text-[13px] text-muted-foreground" style={i(5)}>
        Next.js 16 on Vercel · Supabase Postgres with pgvector · AI SDK with OpenAI ·{" "}
        <Link href="/docs" className="underline underline-offset-2 hover:text-foreground">
          API docs
        </Link>
      </p>
    </main>
  );
}
