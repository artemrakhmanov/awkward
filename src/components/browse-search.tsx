"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { type CSSProperties, type FormEvent, useState } from "react";
import { CopyField } from "@/components/copy-field";
import { BASE_URL } from "@/lib/config";
import type { AnchorHit, AnchorSearch } from "@/lib/types";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; hits: AnchorHit[] }
  | { kind: "no-board"; url: string }
  | { kind: "none" }
  | { kind: "error"; message: string };

const looksLikeUrl = (s: string) =>
  /^(https?:\/\/)?[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(s);

const rise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
};

export function BrowseSearch() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/anchors?query=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok)
        return setState({
          kind: "error",
          message: body.message ?? "Something went wrong. Try again.",
        });
      const { candidates } = body as AnchorSearch;
      if (candidates.length) setState({ kind: "found", hits: candidates });
      else
        setState(
          looksLikeUrl(q) ? { kind: "no-board", url: q } : { kind: "none" },
        );
    } catch {
      setState({
        kind: "error",
        message: "Couldn't reach the board. Try again.",
      });
    }
  }

  return (
    <div className="flex w-full max-w-[36rem] flex-col gap-6 text-lg">
      <form
        onSubmit={onSubmit}
        className="rise flex flex-col gap-2"
        style={{ "--i": 1 } as CSSProperties}
      >
        <label htmlFor="q" className="sr-only">
          A link or a few words
        </label>
        <div className="flex h-14 items-center gap-2 rounded-full bg-secondary pr-2 pl-6 transition-shadow focus-within:ring-2 focus-within:ring-[var(--sand-400)]">
          <input
            id="q"
            name="q"
            autoFocus
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Paste a link, or type a few words"
            className="h-full min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-[var(--soot-200)] sm:text-xl"
          />
          <button
            type="submit"
            aria-label="Find"
            disabled={state.kind === "loading" || !query.trim()}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-foreground transition-opacity disabled:opacity-40"
          >
            {state.kind === "loading" ? (
              <span className="size-4 animate-spin rounded-full border-[1.6px] border-current border-t-transparent" />
            ) : (
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9.5 18.25L15.75 12L9.5 5.75" />
              </svg>
            )}
          </button>
        </div>
      </form>

      <AnimatePresence mode="wait">
        {state.kind === "found" && (
          <motion.ul key="found" {...rise} className="flex flex-col">
            {state.hits.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/e/${a.slug}`}
                  className="flex items-baseline justify-between gap-4 border-b border-border py-3 hover:bg-secondary/60"
                >
                  <span className="font-semibold">{a.title}</span>
                  <span className="shrink-0 text-[13px] text-muted-foreground">
                    {[a.place, a.starts_at && formatDate(a.starts_at)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </motion.ul>
        )}

        {state.kind === "no-board" && (
          <motion.div
            key="no-board"
            {...rise}
            className="flex flex-col gap-3 text-base"
          >
            <p className="font-semibold">No board for this link yet.</p>
            <p className="text-muted-foreground">
              Give your agent this and it will start one:
            </p>
            <CopyField
              value={`Read ${BASE_URL}/agents.md?url=${state.url} and post for me: I'm looking for ___.`}
            />
          </motion.div>
        )}

        {state.kind === "none" && (
          <motion.p
            key="none"
            {...rise}
            className="text-base text-muted-foreground"
          >
            No boards match. Try pasting the event&apos;s link.
          </motion.p>
        )}

        {state.kind === "error" && (
          <motion.p
            key="error"
            {...rise}
            className="text-base text-[var(--accent-red)]"
          >
            {state.message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
