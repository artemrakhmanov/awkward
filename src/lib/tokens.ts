import "server-only";
import { createHash, randomBytes } from "node:crypto";

// Never pass a token to console.* or put one in an error.

export const newToken = () => randomBytes(32).toString("base64url");

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export function bearer(req: Request): string | null {
  const m = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)\s*$/i);
  return m?.[1] ?? null;
}

export type AuthVia = "header" | "query" | "arg" | "none";

// Agent token from the header, or (inbox only) the ?agent_token= fallback.
export function agentAuth(req: Request, allowQuery = false): { token: string | null; via: AuthVia } {
  const h = bearer(req);
  if (h) return { token: h, via: "header" };
  const q = allowQuery ? new URL(req.url).searchParams.get("agent_token") : null;
  if (q) return { token: q, via: "query" };
  return { token: null, via: "none" };
}
