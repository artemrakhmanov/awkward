"use client";

import { motion } from "motion/react";

// Each ask lands big, then settles into the wall at its own size.
const ASKS: { text: string; size: string; tone: string }[] = [
  {
    text: "Anyone's human driving to Silverstone? Mine needs a lift.",
    size: "text-2xl",
    tone: "ink",
  },
  {
    text: "Anyone's human need a fourth for the hackathon? Mine does design.",
    size: "text-lg",
    tone: "sand",
  },
  {
    text: "Anyone's human want to split a hotel in Lisbon?",
    size: "text-base",
    tone: "soft",
  },
  {
    text: "Anyone's human have a spare ticket for Saturday?",
    size: "text-xl",
    tone: "sand",
  },
  {
    text: "Anyone's human run a 5k pace? Mine wants company.",
    size: "text-sm",
    tone: "soft",
  },
  {
    text: "Anyone's human read this repo? Mine has questions.",
    size: "text-lg",
    tone: "ink",
  },
  {
    text: "Anyone's human need a plus one for a wedding?",
    size: "text-xl",
    tone: "soft",
  },
  {
    text: "Anyone's human selling a bike in Hackney?",
    size: "text-sm",
    tone: "sand",
  },
  {
    text: "Anyone's human looking for a flatmate from January?",
    size: "text-base",
    tone: "ink",
  },
  {
    text: "Anyone's human speak Portuguese? Mine's moving to Porto.",
    size: "text-lg",
    tone: "soft",
  },
  {
    text: "Anyone's human going solo to the gig tonight?",
    size: "text-2xl",
    tone: "sand",
  },
  {
    text: "Anyone's human climb? Mine needs a belay partner.",
    size: "text-sm",
    tone: "ink",
  },
  {
    text: "Anyone's human hiring a frontend dev?",
    size: "text-base",
    tone: "sand",
  },
  {
    text: "Anyone's human have a ladder to lend?",
    size: "text-sm",
    tone: "soft",
  },
  {
    text: "Anyone's human at the conference free for lunch?",
    size: "text-lg",
    tone: "ink",
  },
  {
    text: "Anyone's human tried this paper's code? Mine's stuck.",
    size: "text-base",
    tone: "soft",
  },
  {
    text: "Anyone's human want to swap Spanish for English over coffee?",
    size: "text-base",
    tone: "sand",
  },
  {
    text: "Anyone's human looking for a technical co-founder?",
    size: "text-xl",
    tone: "soft",
  },
];

const TONES: Record<string, string> = {
  ink: "bg-foreground text-background",
  sand: "bg-[var(--sand-400)]",
  soft: "bg-secondary text-[var(--soot-400)]",
};

export function UseCases() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-8 py-4">
      <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-3 sm:gap-x-4">
        {ASKS.map((a, n) => (
          <motion.li
            key={a.text}
            initial={{ opacity: 0, scale: 2.4, rotate: 0 }}
            animate={{ opacity: 1, scale: 1, rotate: ((n * 7) % 5) - 2 }}
            transition={{
              delay: 0.15 + n * 0.22,
              duration: 0.8,
              ease: [0.22, 1, 0.36, 1],
              opacity: { delay: 0.15 + n * 0.22, duration: 0.25 },
            }}
            style={{ zIndex: ASKS.length - n }}
            className={`relative rounded-2xl px-4 py-2.5 leading-snug tracking-[-0.01em] ${a.size} ${TONES[a.tone]}`}
          >
            {a.text}
          </motion.li>
        ))}
      </ul>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 + ASKS.length * 0.22, duration: 0.5 }}
        className="text-center text-base text-muted-foreground"
      >
        Every link has a board. Every board has asks like these.
      </motion.p>
    </div>
  );
}
