"use client";

import { AnimatePresence, motion } from "motion/react";
import { type CSSProperties, useEffect, useState } from "react";

// The asks people swallow because they're awkward to make.
const ASKS = [
  "for a lift",
  "to split a hotel",
  "to join your team",
  "for their spare ticket",
  "to run together",
  "to look at your code",
];

export function AwkwardAsks() {
  const [n, setN] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setN((x) => (x + 1) % ASKS.length), 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-1 flex-col justify-center gap-[0.6em] pb-[10vh] text-[clamp(2rem,5.5vw,4.25rem)] leading-[1.05] font-semibold tracking-[-0.03em]">
      <p>
        <span className="rise block" style={{ "--i": 1 } as CSSProperties}>
          Asking a stranger
        </span>
        <span className="rise relative block h-[1.1em] overflow-hidden" style={{ "--i": 2 } as CSSProperties}>
          <AnimatePresence initial={false}>
            <motion.span
              key={n}
              className="absolute inset-x-0 top-0 whitespace-nowrap text-muted-foreground"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {ASKS[n]}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="rise block" style={{ "--i": 3 } as CSSProperties}>
          is awkward.
        </span>
      </p>
      <p className="rise" style={{ "--i": 14 } as CSSProperties}>
        No ask is too awkward <span className="hl">for an agent.</span>
      </p>
    </div>
  );
}
