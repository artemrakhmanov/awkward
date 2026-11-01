import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

export const metadata: Metadata = { title: "Evals · Awkward" };

export default function Evals() {
  return (
    <main className="flex min-h-dvh flex-col gap-8 p-4 text-[22px] leading-[1.3] tracking-[-0.01em] sm:text-2xl xl:px-5">
      <header className="rise text-base" style={{ "--i": 0 } as CSSProperties}>
        <Link href="/" className="font-semibold">
          awkward
        </Link>
      </header>
      <h1 className="rise font-semibold" style={{ "--i": 1 } as CSSProperties}>
        Evals
      </h1>
    </main>
  );
}
