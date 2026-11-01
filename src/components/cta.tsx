import Link from "next/link";
import type { ComponentProps, CSSProperties } from "react";

// A text link with a hand-drawn highlighter behind the label and a chevron.
export function Cta({
  i = 0,
  children,
  ...props
}: ComponentProps<typeof Link> & { i?: number }) {
  return (
    <Link {...props} className="font-semibold" style={{ "--i": i } as CSSProperties}>
      <span className="hl">{children}</span>
      <svg
        className="ml-[0.1em] inline-block size-[0.9em] align-[-0.18em]"
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
    </Link>
  );
}
