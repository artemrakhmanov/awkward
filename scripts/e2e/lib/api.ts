// The script's own calls to prod: board setup and snapshots, human inboxes, the server log, cleanup.
import { BASE, TRIAL_KEY } from "./env";

const J = { "content-type": "application/json" };
const keyed = { ...J, authorization: `Bearer ${TRIAL_KEY}` };

export type Http = { status: number; body: unknown };

// Retries network failures (not HTTP errors) up to 3 times.
async function call(path: string, init: RequestInit = {}): Promise<Http> {
  let res: Response | null = null;
  for (let k = 0; !res; k++) {
    try {
      res = await fetch(`${BASE}${path}`, { ...init, headers: { ...J, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(60_000) });
    } catch (e) {
      if (k >= 2) throw e;
      await new Promise((ok) => setTimeout(ok, 1500 * (k + 1)));
    }
  }
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: res.status, body };
}

export const createBoard = (b: { url: string; title: string; starts_at?: string; place?: string }) =>
  call("/api/anchors", { method: "POST", body: JSON.stringify(b) });

export const boardSnapshot = (url: string) => call(`/api/board/${encodeURIComponent(url)}`);

export const findBoards = (query: string) => call(`/api/anchors?query=${encodeURIComponent(query)}`);

// A post made by the script itself, e.g. a planted hostile post (S5).
export const scriptPost = (body: Record<string, unknown>) => call("/api/requests", { method: "POST", body: JSON.stringify(body) });

export const humanInbox = (token: string) => call("/api/human/inbox", { headers: { authorization: `Bearer ${token}` } });

export const agentInbox = (token: string) => call("/api/agent/inbox", { headers: { authorization: `Bearer ${token}` } });

export type LogRow = {
  id: number;
  at: string;
  door: string;
  route: string;
  user_agent: string | null;
  auth_via: string | null;
  body: unknown;
  result: string;
  req_ref: string | null;
};

export async function logSince(id: number): Promise<LogRow[]> {
  const r = await call(`/api/trial/log?limit=1000`, { headers: keyed });
  if (r.status !== 200 || !Array.isArray(r.body)) throw new Error(`log read failed: ${r.status}`);
  return (r.body as LogRow[]).filter((row) => row.id > id).sort((a, b) => a.id - b.id);
}

export async function lastLogId(): Promise<number> {
  const r = await call(`/api/trial/log?limit=1`, { headers: keyed });
  return Array.isArray(r.body) && r.body[0] ? (r.body[0] as LogRow).id : 0;
}

export const cleanup = (url: string) => call("/api/trial/cleanup", { method: "POST", headers: keyed, body: JSON.stringify({ url }) });

export const cleanupId = (id: string) => call("/api/trial/cleanup", { method: "POST", headers: keyed, body: JSON.stringify({ id }) });
