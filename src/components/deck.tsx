"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// The slide index lives in the URL hash (#2, #3) so a slide can be linked to.
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("hashchange", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("hashchange", fn);
  };
}
const readHash = () => window.location.hash;

const variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 40 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -40 }),
};

export function Deck({ slides }: { slides: ReactNode[] }) {
  const count = slides.length;
  const hash = useSyncExternalStore(subscribe, readHash, () => "");
  const parsed = Number.parseInt(hash.slice(1), 10) - 1;
  const index = parsed >= 0 && parsed < count ? parsed : 0;
  const [dir, setDir] = useState(1);

  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(count - 1, to));
      if (next === index) return;
      setDir(next > index ? 1 : -1);
      const url = next === 0 ? window.location.pathname + window.location.search : `#${next + 1}`;
      window.history.replaceState(null, "", url);
      listeners.forEach((fn) => fn());
    },
    [count, index],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (["ArrowRight", "ArrowDown", "PageDown"].includes(e.key)) go(index + 1);
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) go(index - 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(count - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, count]);

  const touch = useRef<{ x: number; y: number } | null>(null);

  return (
    <main
      className="relative flex h-dvh flex-col gap-8 overflow-hidden p-4 text-[22px] leading-[1.3] tracking-[-0.01em] sm:text-2xl xl:px-5"
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <header className="rise flex items-center justify-between text-base" style={{ "--i": 0 } as CSSProperties}>
        <button type="button" onClick={() => go(0)} className="font-semibold">
          awkward
        </button>
        <nav aria-label="Slides" className="flex items-center gap-1 text-[13px] text-muted-foreground tabular-nums">
          <NavButton label="Previous" disabled={index === 0} onClick={() => go(index - 1)} flip />
          <span aria-live="polite">
            {index + 1} / {count}
          </span>
          <NavButton label="Next" disabled={index === count - 1} onClick={() => go(index + 1)} />
        </nav>
      </header>

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.section
          key={index}
          custom={dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          {slides[index]}
        </motion.section>
      </AnimatePresence>

      <nav
        aria-label="More"
        className="rise absolute right-4 bottom-4 flex gap-5 text-[13px] text-muted-foreground xl:right-5"
        style={{ "--i": 6 } as CSSProperties}
      >
        <Link href="/docs" className="hover:text-foreground">
          Docs
        </Link>
        <Link href="/evals" className="hover:text-foreground">
          Evals
        </Link>
        <Link href="/architecture" className="hover:text-foreground">
          Architecture
        </Link>
      </nav>
    </main>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  flip,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  flip?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-full transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <svg
        className={`size-4 ${flip ? "rotate-180" : ""}`}
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
    </button>
  );
}
