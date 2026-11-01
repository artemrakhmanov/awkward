import type { CSSProperties, ReactNode } from "react";

// Hand-drawn line doodles. Ink strokes draw themselves in (see .draw in globals.css),
// over a soft sand blob.
function Doodle({ i = 0, children }: { i?: number; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className="draw size-16 text-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ "--i": i } as CSSProperties}
    >
      <path
        className="blob"
        d="M24 5.5C34.5 4.8 43.2 13 42.4 24.2 41.6 35 33.4 43.2 22.4 42.4 12 41.6 4.8 33.2 5.6 22.8 6.4 12.6 14 6.2 24 5.5Z"
        fill="var(--sand-100)"
        stroke="none"
      />
      {children}
    </svg>
  );
}

// A note pinned to a board.
export function BoardDoodle({ i }: { i?: number }) {
  return (
    <Doodle i={i}>
      <path
        pathLength={1}
        d="M11 14.4C18 12.8 30 13.8 37.6 13c.8 7.4.2 16.8 1 24.6-8.6.8-20.4-.4-28.6.6.8-8.4-.2-17.4 1-23.8Z"
      />
      <path
        pathLength={1}
        d="M24 10.6c1.8 0 2.8 1.2 2.6 2.8-.2 1.4-1.4 2.2-2.8 2-1.4-.2-2.2-1.4-2-2.8.2-1.2 1-2 2.2-2Z"
      />
      <path pathLength={1} d="M16 22.6c5-.6 11.4.4 17-.4" />
      <path pathLength={1} d="M16 28.4c4-.4 8.6.4 12.6-.2" />
    </Doodle>
  );
}

// A speech bubble, mid-sentence.
export function AgentDoodle({ i }: { i?: number }) {
  return (
    <Doodle i={i}>
      <path
        pathLength={1}
        d="M8.4 14.6C8.2 10.8 10.8 8.6 14.8 8.6l18.8.4c4 .2 6.2 2.4 6.2 6.2l-.4 10.8c-.2 4-2.4 6-6.4 6H20.4l-7.2 6.8.8-6.8c-3.8 0-5.8-2.2-5.8-5.8l.2-11.6Z"
      />
      <path pathLength={1} strokeWidth="3" d="M17 20.4h.1" />
      <path pathLength={1} strokeWidth="3" d="M24 20.2h.1" />
      <path pathLength={1} strokeWidth="3" d="M31 20.6h.1" />
      <path pathLength={1} d="M42.6 4.4v5.2M40 7h5.2" />
    </Doodle>
  );
}

// Two people, one heart.
export function YesDoodle({ i }: { i?: number }) {
  return (
    <Doodle i={i}>
      <path
        pathLength={1}
        d="M13 17.2c3.6 0 5.8 2.6 5.6 5.8-.2 3.4-2.8 5.6-6 5.4-3.2-.2-5.4-2.6-5.2-5.8.2-3.2 2.6-5.4 5.6-5.4Z"
      />
      <path
        pathLength={1}
        d="M35 17.2c3.6 0 5.8 2.6 5.6 5.8-.2 3.4-2.8 5.6-6 5.4-3.2-.2-5.4-2.6-5.2-5.8.2-3.2 2.6-5.4 5.6-5.4Z"
      />
      <path pathLength={1} d="M10.8 24.2c1.4 1.4 3.4 1.4 4.6 0" />
      <path pathLength={1} d="M32.8 24.2c1.4 1.4 3.4 1.4 4.6 0" />
      <path
        pathLength={1}
        d="M24 10.2c-1.4-2.6-4.6-1.8-3.6.8L24 14.8l3.6-3.8c1-2.6-2.2-3.4-3.6-.8Z"
      />
      <path pathLength={1} d="M13 33.6c3 3.4 8 4.6 11 4.4s8-1 11-4.4" />
    </Doodle>
  );
}
