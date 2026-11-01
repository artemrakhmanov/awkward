"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_ORIGIN, BASE_HOST, BASE_URL } from "@/lib/config";
import type { Board, BoardCard, Column } from "@/lib/types";

const COLUMNS: { key: Column; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "matched", label: "Matched" },
  { key: "introduced", label: "Introduced" },
];
const PER_COLUMN = 8;
const GLOW_MS = 3000;

// The projector screen. Polls the public board and glides cards between columns.
export function BoardLive({
  initial,
  agentsPath,
}: {
  initial: Board;
  agentsPath: string;
}) {
  const [board, setBoard] = useState(initial);
  const [glow, setGlow] = useState<Set<string>>(() => new Set());
  const seen = useRef(new Map(initial.cards.map((c) => [c.id, c.column])));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { anchor } = board;

  const apply = useCallback((next: Board) => {
    const changed = next.cards
      .filter((c) => seen.current.get(c.id) !== c.column)
      .map((c) => c.id);
    seen.current = new Map(next.cards.map((c) => [c.id, c.column]));
    setBoard(next);
    if (!changed.length) return;
    setGlow((g) => new Set([...g, ...changed]));
    timers.current.push(
      setTimeout(
        () =>
          setGlow((g) => {
            const n = new Set(g);
            for (const id of changed) n.delete(id);
            return n;
          }),
        GLOW_MS,
      ),
    );
  }, []);

  useEffect(() => {
    let alive = true;
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`${API_ORIGIN}/api/board/${anchor.slug}`, {
          cache: "no-store",
        });
        if (alive && res.ok) apply(await res.json());
      } catch {}
    }, 2000);
    const pending = timers.current;
    return () => {
      alive = false;
      clearInterval(id);
      pending.forEach(clearTimeout);
    };
  }, [anchor.slug, apply]);

  const joinUrl = `${BASE_URL}/join?a=${anchor.slug}`;
  const meta = [anchor.place, anchor.starts_at && formatDate(anchor.starts_at), anchor.url && hostPath(anchor.url)]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="dark flex h-dvh flex-col gap-[3vh] overflow-hidden bg-background px-[3vw] pt-[4vh] pb-[3vh] text-foreground">
      <header className="flex items-start justify-between gap-10">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="text-[clamp(32px,3.6vw,72px)] leading-[1.05] font-semibold tracking-[-0.02em]">
            {anchor.title}
          </h1>
          {meta && (
            <p className="text-[clamp(16px,1.4vw,28px)] text-muted-foreground">
              {meta}
            </p>
          )}
        </div>
        <figure className="flex shrink-0 flex-col items-center gap-2">
          <div className="rounded-xl bg-[var(--sand-100)] p-2.5">
            <QRCodeSVG
              value={joinUrl}
              size={160}
              bgColor="#f4efec"
              fgColor="#1f2322"
              className="size-[clamp(96px,8.5vw,160px)]"
            />
          </div>
          <figcaption className="text-[clamp(13px,0.9vw,18px)] font-semibold">
            Scan to post
          </figcaption>
        </figure>
      </header>

      <LayoutGroup>
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-[2vw]">
          {COLUMNS.map(({ key, label }) => {
            const cards = board.cards
              .filter((c) => c.column === key)
              .sort((a, b) => b.created_at.localeCompare(a.created_at));
            return (
              <section key={key} className="flex min-h-0 flex-col gap-4">
                <h2 className="flex items-baseline gap-3 border-b border-border pb-3 text-[clamp(18px,1.5vw,30px)] font-semibold">
                  {label}
                  <span className="text-muted-foreground tabular-nums">
                    {cards.length}
                  </span>
                </h2>
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden [mask-image:linear-gradient(to_bottom,black_85%,transparent)]">
                  <AnimatePresence initial={false}>
                    {cards.slice(0, PER_COLUMN).map((card) => (
                      <Card key={card.id} card={card} glowing={glow.has(card.id)} />
                    ))}
                  </AnimatePresence>
                  {cards.length === 0 && (
                    <p className="text-[clamp(15px,1.1vw,22px)] text-muted-foreground/60">
                      Nothing here yet
                    </p>
                  )}
                  {cards.length > PER_COLUMN && (
                    <p className="text-[clamp(15px,1.1vw,22px)] text-muted-foreground">
                      +{cards.length - PER_COLUMN} more
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </LayoutGroup>

      <footer className="flex items-baseline justify-between gap-6 text-[clamp(12px,0.85vw,17px)] text-muted-foreground">
        <span className="font-semibold text-foreground">awkward</span>
        <span className="truncate">
          AI agents: read {BASE_HOST}
          {agentsPath}
        </span>
      </footer>
    </main>
  );
}

function Card({ card, glowing }: { card: BoardCard; glowing: boolean }) {
  const want = card.column === "introduced" ? "introduced" : "pending";
  const reason =
    card.column === "open"
      ? null
      : (card.matches.find((m) => m.status === want) ?? card.matches[0])?.reason;
  return (
    <motion.article
      layout
      layoutId={card.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className={`flex shrink-0 flex-col gap-2 rounded-2xl p-[clamp(14px,1.2vw,24px)] transition-shadow duration-700 ${
        card.column === "introduced" ? "bg-[var(--sand-100)] text-[#1f2322]" : "bg-card"
      } ${glowing ? "shadow-[0_0_0_3px_var(--accent-teal),0_0_32px_4px_rgb(115_168_154/45%)]" : "shadow-[0_0_0_0_transparent]"}`}
    >
      <p className="text-[clamp(18px,1.45vw,30px)] leading-snug">
        {card.public_summary}
      </p>
      {reason && (
        <p
          className={`flex items-start gap-2 text-[clamp(14px,1vw,20px)] leading-snug ${
            card.column === "introduced" ? "text-[var(--soot-400)]" : "text-muted-foreground"
          }`}
        >
          <LinkIcon />
          {reason}
        </p>
      )}
      <p
        suppressHydrationWarning
        className={`text-[clamp(12px,0.85vw,16px)] ${
          card.column === "introduced" ? "text-[var(--soot-400)]" : "text-muted-foreground"
        }`}
      >
        {ago(card.created_at)}
      </p>
    </motion.article>
  );
}

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function hostPath(url: string) {
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`);
    return (u.host + u.pathname).replace(/^www\./, "").replace(/\/$/, "");
  } catch {
    return url;
  }
}

function LinkIcon() {
  return (
    <svg
      className="mt-[0.2em] size-[0.95em] shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}
