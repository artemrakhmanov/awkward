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

// Open posts are sand cards; fits are warmer notes; introductions turn teal.
const PAPER: Record<Column, string> = {
  open: "#f4efec",
  matched: "#f3e6cf",
  introduced: "#d9e8e2",
};
// Ink, red, teal and soot, from the palette.
const PINS = ["#ed313e", "#1f2322", "#73a89a", "#585254"];
const MUTED = "var(--soot-400)";
const FAINT = "var(--soot-200)";
const PAPER_SHADOW =
  "shadow-[0_1px_1px_rgb(31_35_34/6%),0_12px_22px_-14px_rgb(31_35_34/40%)]";

const spring = { type: "spring", stiffness: 240, damping: 28 } as const;

// The projector screen: a corkboard. Polls the public board and moves notes between columns.
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
  const meta = [
    anchor.place,
    anchor.starts_at && formatDate(anchor.starts_at),
    anchor.url && hostPath(anchor.url),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="cork flex min-h-dvh flex-col gap-8 px-5 pt-8 pb-6 text-[#1f2322] md:h-dvh md:gap-[2.5vh] md:overflow-hidden md:px-[3.2vw] md:pt-[5vh] md:pb-[3vh]">
      <header className="flex items-start justify-between gap-6 md:gap-10">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-[clamp(30px,3.4vw,72px)] leading-[1.02] font-semibold tracking-[-0.025em]">
            {anchor.title}
          </h1>
          {meta && (
            <p className="text-[clamp(15px,1.3vw,27px)]" style={{ color: MUTED }}>
              {meta}
            </p>
          )}
        </div>

        {/* QR on a pinned card. */}
        <figure className={`relative flex shrink-0 rotate-[2deg] flex-col items-center gap-2 rounded-[3px] bg-[#f4efec] px-3 pt-5 pb-3 ${PAPER_SHADOW}`}>
          <Pin color={PINS[0]} />
          <QRCodeSVG
            value={joinUrl}
            size={160}
            bgColor="#f4efec"
            fgColor="#1f2322"
            className="size-[clamp(90px,8vw,160px)]"
          />
          <figcaption className="text-[clamp(13px,1vw,20px)] leading-none font-semibold">
            <span className="hl">Scan to post</span>
          </figcaption>
        </figure>
      </header>

      <LayoutGroup>
        <div className="flex min-h-0 flex-1 flex-col gap-10 md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-[1.4vw]">
          {COLUMNS.map(({ key, label }, n) => {
            const cards = board.cards
              .filter((c) => c.column === key)
              .sort((a, b) => b.created_at.localeCompare(a.created_at));
            const shown = cards.slice(0, PER_COLUMN);
            return [
              n > 0 && <Divider key={`line-${key}`} flip={n % 2 === 0} />,
              <section key={key} className="flex min-h-0 flex-col gap-[1.5vh]">
                <h2 className="flex items-center gap-3 self-start">
                  <span className="text-[clamp(20px,1.6vw,32px)] leading-none font-semibold">
                    <span className="hl">{label}</span>
                  </span>
                  <span
                    className="text-[clamp(20px,1.6vw,32px)] leading-none tabular-nums"
                    style={{ color: FAINT }}
                  >
                    {cards.length}
                  </span>
                </h2>
                <div className="flex min-h-0 flex-1 flex-col gap-7 px-1 pt-4 pb-2 md:gap-[3vh] md:overflow-hidden md:px-[0.6vw] md:pt-[2.2vh] md:pb-6">
                  <AnimatePresence initial={false}>
                    {key === "open"
                      ? shown.map((card) => (
                          <Note key={card.id} card={card} glowing={glow.has(card.id)} />
                        ))
                      : pairs(shown).map((group) => (
                          <Pair
                            key={group.key}
                            cards={group.cards}
                            reason={group.reason}
                            introduced={key === "introduced"}
                            glow={glow}
                          />
                        ))}
                  </AnimatePresence>
                  {cards.length === 0 && (
                    <p
                      className="text-[clamp(16px,1.2vw,24px)]"
                      style={{ color: FAINT }}
                    >
                      Nothing here yet
                    </p>
                  )}
                  {cards.length > PER_COLUMN && (
                    <p
                      className="text-[clamp(16px,1.2vw,24px)] font-semibold"
                      style={{ color: MUTED }}
                    >
                      +{cards.length - PER_COLUMN} more
                    </p>
                  )}
                </div>
              </section>,
            ];
          })}
        </div>
      </LayoutGroup>

      <footer
        className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-[clamp(12px,0.85vw,17px)]"
        style={{ color: MUTED }}
      >
        <span className="font-semibold text-[#1f2322]">awkward</span>
        <span className="break-all opacity-80 md:truncate md:break-normal">
          AI agents: read {BASE_HOST}
          {agentsPath}
        </span>
      </footer>
    </main>
  );
}

// Both sides of a match share the same reason, so their cards pair up by it.
function pairs(cards: BoardCard[]) {
  const out: { key: string; reason: string; cards: BoardCard[] }[] = [];
  for (const card of cards) {
    const want = card.column === "introduced" ? "introduced" : "pending";
    const reason =
      (card.matches.find((m) => m.status === want) ?? card.matches[0])?.reason ?? "";
    const group = out.find((g) => g.reason === reason && g.cards.length < 2);
    if (group) group.cards.push(card);
    else out.push({ key: card.id, reason, cards: [card] });
  }
  return out;
}

function Pair({
  cards,
  reason,
  introduced,
  glow,
}: {
  cards: BoardCard[];
  reason: string;
  introduced: boolean;
  glow: Set<string>;
}) {
  const pin = PINS[(hash(cards[0].id) % (PINS.length - 1)) + 1];
  return (
    <motion.div layout transition={spring} className="relative flex shrink-0 flex-col">
      <Note card={cards[0]} glowing={glow.has(cards[0].id)} pin={pin} />
      {reason && (
        <motion.p
          layout="position"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring}
          className="tape relative z-20 mx-[7%] -my-3 -rotate-[1deg] px-4 py-1.5 text-[clamp(14px,1.05vw,21px)] leading-snug font-medium"
        >
          {reason}
        </motion.p>
      )}
      {/* The tape holds the second note, so it has no pin. */}
      {cards[1] && <Note card={cards[1]} glowing={glow.has(cards[1].id)} pin={null} />}
      <AnimatePresence>
        {introduced && (
          <motion.span
            key="stamp"
            initial={{ opacity: 0, scale: 1.8 }}
            animate={{ opacity: 0.9, scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.4 }}
            className="pointer-events-none absolute right-[4%] -bottom-[1.2vh] z-30 -rotate-[8deg] rounded-[4px] border-2 border-[var(--accent-red)] px-2.5 pt-1 pb-0.5 text-[clamp(12px,0.95vw,20px)] font-semibold tracking-[0.06em] text-[var(--accent-red)] uppercase mix-blend-multiply"
          >
            Both said yes
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Note({
  card,
  glowing,
  pin = PINS[0],
}: {
  card: BoardCard;
  glowing: boolean;
  pin?: string | null;
}) {
  const rotate = ((hash(card.id) % 9) - 4) * 0.4;
  const sticky = card.column !== "open";
  return (
    <motion.article
      layout
      layoutId={card.id}
      initial={{ opacity: 0, y: -36, scale: 1.08, rotate }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={spring}
      style={{ background: PAPER[card.column] }}
      className={`relative flex shrink-0 flex-col gap-2 px-[clamp(16px,1.3vw,26px)] pt-[clamp(20px,1.6vw,30px)] pb-[clamp(12px,1vw,20px)] transition-[box-shadow,background-color] duration-700 ${
        sticky ? "rounded-[3px] rounded-br-[20px_8px]" : "rounded-[3px]"
      } ${
        glowing
          ? "shadow-[0_0_0_2px_var(--accent-teal),0_0_36px_6px_rgb(115_168_154/40%),0_12px_22px_-14px_rgb(31_35_34/40%)]"
          : PAPER_SHADOW
      }`}
    >
      {pin && <Pin color={pin} />}
      <p className="text-[clamp(17px,1.4vw,29px)] leading-snug">{card.public_summary}</p>
      <p
        suppressHydrationWarning
        className="text-[clamp(12px,0.85vw,17px)] leading-none"
        style={{ color: FAINT }}
      >
        {ago(card.created_at)}
      </p>
    </motion.article>
  );
}

// A push pin with a highlight and a cast shadow.
function Pin({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-[clamp(6px,0.45vw,10px)] left-1/2 z-10 size-[clamp(13px,1vw,20px)] -translate-x-1/2 rounded-full"
      style={{
        background: `radial-gradient(circle at 34% 30%, rgb(255 255 255 / 70%) 0 12%, ${color} 45%, color-mix(in srgb, ${color}, black 30%) 100%)`,
        boxShadow: "2px 4px 4px rgb(31 35 34 / 28%)",
      }}
    />
  );
}

// A hand-drawn vertical line between columns.
function Divider({ flip }: { flip: boolean }) {
  const w = flip ? -1 : 1;
  return (
    <svg
      aria-hidden="true"
      className="hidden h-full w-3 opacity-70 md:block"
      viewBox="0 0 12 1000"
      preserveAspectRatio="none"
    >
      <path
        d={`M6 6 C ${6 + 4 * w} 200, ${6 - 4 * w} 380, 6 540 S ${6 + 3 * w} 840, ${6 - w} 994`}
        fill="none"
        stroke="var(--soot-200)"
        strokeWidth="1.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
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
