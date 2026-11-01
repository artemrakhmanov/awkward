// Shapes of the published e2e files (scripts/e2e/publish.ts → public/evals/).
export type Status = "pass" | "fail" | "error" | "skipped";

export type IndexRun = {
  run_id: string;
  scenario: { id: string; name: string; summary: string };
  started_at: string;
  finished_at: string;
  seconds: number;
  model: string;
  git_sha: string | null;
  board_title: string;
  actors: { id: string; role: string; door: string; session_id: string | null }[];
  summary: { pass: number; fail: number; error: number; skipped: number };
  evals: { id: string; name: string; status: Status; why: string }[];
  shots: number;
};
export type EvalIndex = { published_at: string; runs: IndexRun[] };

export type Evidence = { label: string; kind: string; content: string };
export type RunEval = { id: string; name: string; status: Status; judge: string; why: string; evidence: Evidence[] };
export type ToolCall = { kind: string; name: string; input: unknown; output: unknown; status?: string | null; error?: unknown };
export type Turn = { actor: string; step: string; t: number; ms: number; prompt: string; reply: string; calls: ToolCall[]; attempts: number; error?: string };
export type TimelineEvent = { i: number; t: number; from: string; to: string; kind: string; label: string; status?: string | number; source: string; detail?: unknown };
export type Shot = { name: string; file: string; t: number; url: string; text?: string };

export type RunFile = {
  run_id: string;
  scenario: { id: string; name: string; summary: string };
  started_at: string;
  finished_at: string;
  model: string;
  git_sha: string | null;
  board: { url: string; slug: string | null; title: string };
  actors: { id: string; role: string; door: string; client: string; session_id: string | null }[];
  summary: { pass: number; fail: number; error: number; skipped: number };
  evals: RunEval[];
  events: TimelineEvent[];
  transcripts: Record<string, Turn[]>;
  board_snapshots: { step: string; t: number; status: number; board: unknown }[];
  screenshots: Shot[];
  server_log: unknown[];
  cleanup: unknown;
  notes: string[];
};

export const runPath = (id: string) => `/evals/runs/${id}`;
