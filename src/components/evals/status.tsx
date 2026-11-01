import type { Status } from "./types";

const DOT: Record<Status, string> = {
  pass: "bg-[var(--accent-teal)]",
  fail: "bg-[var(--accent-red)]",
  error: "border-2 border-[var(--soot-400)] bg-transparent",
  skipped: "border border-border bg-transparent",
};
const WORD: Record<Status, string> = { pass: "Pass", fail: "Fail", error: "Error", skipped: "Skipped" };

export function StatusDot({ status, title, className = "size-2.5" }: { status: Status; title?: string; className?: string }) {
  return <span title={title} aria-label={title ?? WORD[status]} className={`inline-block shrink-0 rounded-full ${DOT[status]} ${className}`} />;
}

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-[13px] font-semibold">
      <StatusDot status={status} className="size-2" />
      {WORD[status]}
    </span>
  );
}

export function Score({ pass, total }: { pass: number; total: number }) {
  return (
    <span className="tabular-nums">
      {pass}/{total}
    </span>
  );
}

export const duration = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
export const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
export const doors = (actors: { door: string }[]) => [...new Set(actors.map((a) => a.door.toUpperCase()))].join(" + ");
