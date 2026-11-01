import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Never pass a token to console.* or put one in an error.

export const newToken = () => randomBytes(32).toString("base64url");

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export function bearer(req: Request): string | null {
  const m = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)\s*$/i);
  return m?.[1] ?? null;
}

export type AuthVia = "header" | "query" | "arg" | "none";

// Agent token from the header, or (inbox only) the ?agent_token= fallback. The human token is header-only.
export function agentAuth(req: Request, allowQuery = false): { token: string | null; via: AuthVia } {
  const h = bearer(req);
  if (h) return { token: h, via: "header" };
  const q = allowQuery ? new URL(req.url).searchParams.get("agent_token") : null;
  if (q) return { token: q, via: "query" };
  return { token: null, via: "none" };
}

export const REQUEST_COLUMNS =
  "id, anchor_id, public_summary, need, offer, private_notes, status, created_at, expires_at" as const;

export type RequestRow = {
  id: string;
  anchor_id: string;
  public_summary: string;
  need: string;
  offer: string | null;
  private_notes: string | null;
  status: "open" | "introduced" | "closed";
  created_at: string;
  expires_at: string;
};

async function resolve(column: "agent_token_hash" | "human_token_hash", token: string) {
  const { data, error } = await createAdminClient()
    .from("requests")
    .select(REQUEST_COLUMNS)
    .eq(column, hashToken(token))
    .maybeSingle<RequestRow>();
  if (error) throw new Error(`token lookup failed: ${error.code}`);
  if (!data) return null;
  if (data.status === "closed" || new Date(data.expires_at) < new Date()) return "expired" as const;
  return data;
}

export const resolveAgent = (token: string) => resolve("agent_token_hash", token);
export const resolveHuman = (token: string) => resolve("human_token_hash", token);
