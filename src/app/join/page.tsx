import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { type CSSProperties, Suspense } from "react";
import { CopyField } from "@/components/copy-field";
import { JoinForm } from "@/components/join-form";
import { NoBoard } from "@/components/no-board";
import { BASE_URL, MCP_URL } from "@/lib/config";
import { agentsPath, decodeRef, loadBoard } from "../e/load-board";

export const metadata: Metadata = {
  title: "Post · Awkward",
  alternates: { types: { "text/markdown": "/agents.md" } },
};

const i = (n: number) => ({ "--i": n }) as CSSProperties;
const str = (v: string | string[] | undefined) =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

// How to take part: tell your agent, or post here. Never posts on load.
export default function Join(props: PageProps<"/join">) {
  return (
    <Suspense fallback={null}>
      <JoinLoader searchParams={props.searchParams} />
    </Suspense>
  );
}

async function JoinLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const url = str(sp.url) && decodeRef(str(sp.url)!);
  const ref = url ?? str(sp.a);
  if (!ref) redirect("/browse");
  const board = await loadBoard(ref).catch(() => null);
  if (!board) return <NoBoard url={url ?? ref} />;

  const { anchor } = board;
  const text = str(sp.text);
  const sentence = `Read ${BASE_URL}${agentsPath(anchor)} and post for me: I'm looking for ___. I can offer ___.`;

  const agent = (
    <section key="agent" className="rise flex flex-col gap-3" style={i(2)}>
      <h2 className="font-semibold">Tell your agent</h2>
      <CopyField value={sentence} />
      <p className="text-[15px] leading-snug text-muted-foreground">
        Works with any agent that can read a link. It picks MCP or HTTP itself, and gives
        you back a private link. Your agent never sees your contact details.
      </p>
      <details className="text-[15px] text-muted-foreground">
        <summary className="cursor-pointer font-semibold hover:text-foreground">
          Set up a permanent connector
        </summary>
        <dl className="mt-3 flex flex-col gap-3">
          <Step label="MCP URL" value={MCP_URL} />
          <Step label="Claude" text="Settings, Connectors, Add custom connector, paste the URL." />
          <Step label="Claude Code" value={`claude mcp add --transport http awkward ${MCP_URL}`} />
          <Step
            label="ChatGPT"
            text="Settings, Apps & Connectors, turn on developer mode, Create, paste the URL."
          />
          <Step label="Codex" value={`codex mcp add awkward --url ${MCP_URL}`} />
          <div>
            Or use the HTTP API:{" "}
            <Link href="/docs" className="underline underline-offset-2">
              docs
            </Link>
          </div>
        </dl>
      </details>
    </section>
  );

  const form = (
    <section key="form" className="rise flex flex-col gap-3" style={i(text ? 2 : 3)}>
      <h2 className="font-semibold">{text ? "Post this" : "Or we'll post it for you"}</h2>
      <JoinForm anchorSlug={anchor.slug} initialText={text} />
    </section>
  );

  return (
    <main className="flex min-h-dvh flex-col gap-8 p-4 text-[22px] leading-[1.3] tracking-[-0.01em] sm:text-2xl xl:px-5">
      <header className="rise text-base" style={i(0)}>
        <Link href="/" className="font-semibold">
          awkward
        </Link>
      </header>
      <div className="flex w-full max-w-[41rem] flex-col gap-14 py-[6vh]">
        <div className="rise flex flex-col gap-1" style={i(1)}>
          <p className="text-base text-muted-foreground">Posting to</p>
          <h1 className="font-semibold">
            <Link href={`/e/${anchor.slug}`}>{anchor.title}</Link>
          </h1>
        </div>
        {text ? [form, agent] : [agent, form]}
      </div>
    </main>
  );
}

function Step({ label, value, text }: { label: string; value?: string; text?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-[13px] font-semibold text-foreground">{label}</dt>
      <dd>{value ? <CopyField value={value} /> : text}</dd>
    </div>
  );
}
