"use client";

import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, useState } from "react";
import { CopyField } from "@/components/copy-field";
import { API_ORIGIN } from "@/lib/config";
import type { JoinResult } from "@/lib/types";

type State =
  | { kind: "idle" }
  | { kind: "posting" }
  | { kind: "error"; message: string }
  | { kind: "done"; result: JoinResult };

const swap = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
};

// Posts on the person's behalf. Only a click posts: preview bots open /join?text= links too.
export function JoinForm({
  anchorSlug,
  initialText = "",
}: {
  anchorSlug: string;
  initialText?: string;
}) {
  const [text, setText] = useState(initialText);
  const [state, setState] = useState<State>({ kind: "idle" });
  const fromAgent = !!initialText;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState({ kind: "posting" });
    try {
      const res = await fetch(`${API_ORIGIN}/api/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ anchor_slug: anchorSlug, text: text.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        return setState({
          kind: "error",
          message: body.message ?? "Something went wrong. Try again.",
        });
      setState({ kind: "done", result: body as JoinResult });
    } catch {
      setState({ kind: "error", message: "Couldn't reach the board. Try again." });
    }
  }

  return (
    <AnimatePresence mode="wait">
      {state.kind === "done" ? (
        <motion.div key="done" {...swap} className="flex flex-col gap-4">
          <p>
            <span className="font-semibold">Bookmark this link.</span>{" "}
            <span className="text-muted-foreground">
              It&apos;s the only way back to your matches.
            </span>
          </p>
          <CopyField value={state.result.human_link} />
          {state.result.matches_found > 0 && (
            <p className="text-base text-muted-foreground">
              {state.result.matches_found === 1
                ? "There's already one possible fit."
                : `There are already ${state.result.matches_found} possible fits.`}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={state.result.human_link}
              className="grid h-12 place-items-center rounded-full bg-foreground px-6 text-base font-semibold text-background"
            >
              Open my page
            </a>
            <ShareButton url={state.result.human_link} />
          </div>
        </motion.div>
      ) : (
        <motion.form key="form" {...swap} onSubmit={onSubmit} className="flex flex-col gap-3">
          {fromAgent && (
            <p className="text-base font-semibold">
              Your agent wrote this for you. Check it and post.
            </p>
          )}
          <label htmlFor="join-text" className="text-base text-muted-foreground">
            What are you looking for here? Anything you can offer?
          </label>
          <textarea
            id="join-text"
            name="text"
            required
            minLength={10}
            maxLength={1000}
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="I'm looking for a lift from east London. Happy to pay for fuel."
            className="min-h-32 w-full resize-y rounded-2xl bg-secondary px-5 py-4 text-lg leading-snug outline-none placeholder:text-[var(--soot-200)] focus:ring-2 focus:ring-[var(--sand-400)]"
          />
          <p className="text-[13px] leading-snug text-muted-foreground">
            We&apos;ll rewrite this into a short anonymous post. Don&apos;t include contact
            details; you choose what to share when there&apos;s a match.
          </p>
          {state.kind === "error" && (
            <p className="text-base text-[var(--accent-red)]">{state.message}</p>
          )}
          <button
            type="submit"
            autoFocus={fromAgent}
            disabled={state.kind === "posting" || text.trim().length < 10}
            className="mt-1 h-12 self-start rounded-full bg-foreground px-6 text-base font-semibold text-background transition-opacity disabled:opacity-40"
          >
            {state.kind === "posting" ? "Posting and looking for a match…" : "Post"}
          </button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

function ShareButton({ url }: { url: string }) {
  const [canShare] = useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
  );
  if (!canShare) return null;
  return (
    <button
      type="button"
      onClick={() => navigator.share({ title: "My Awkward link", url }).catch(() => {})}
      className="grid h-12 place-items-center rounded-full px-5 text-base font-semibold text-muted-foreground hover:text-foreground"
    >
      Send to myself
    </button>
  );
}
