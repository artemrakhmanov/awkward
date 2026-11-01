import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthVia } from "@/lib/tokens";

// Trial only (specs/trial.md): every door writes one row to trial_log. Never log tokens.

export type Door = "http" | "mcp" | "doc" | "human";

const TOKEN_KEYS = new Set(["agent_token", "human_token", "token", "t", "authorization"]);
const TOKEN_LIKE = /[A-Za-z0-9_-]{40,}/g;

export function stripTokens(value: unknown): unknown {
  if (typeof value === "string") return value.replace(TOKEN_LIKE, "[token]").slice(0, 4000);
  if (Array.isArray(value)) return value.map(stripTokens);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, TOKEN_KEYS.has(k.toLowerCase()) ? "[token]" : stripTokens(v)]),
    );
  }
  return value;
}

export async function trialLog(row: {
  door: Door;
  route: string;
  req?: Request;
  auth_via?: AuthVia;
  body?: unknown;
  result: string;
}) {
  try {
    const { error } = await createAdminClient()
      .from("trial_log")
      .insert({
        door: row.door,
        route: row.route,
        user_agent: row.req?.headers.get("user-agent") ?? null,
        auth_via: row.auth_via ?? "none",
        body: row.body === undefined ? null : stripTokens(row.body),
        result: row.result,
      });
    if (error) console.error("trial_log insert failed", error.message);
  } catch (e) {
    console.error("trial_log insert failed", e instanceof Error ? e.message : "unknown");
  }
}

export async function readTrialLog(limit = 100) {
  const { data, error } = await createAdminClient()
    .from("trial_log")
    .select("id, at, door, route, user_agent, auth_via, body, result")
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data;
}

// Read a request body as JSON; on failure keep the raw text so the log shows what the agent sent.
export async function readBody(req: Request): Promise<{ data: unknown; raw?: string }> {
  const raw = await req.text();
  try {
    return { data: raw ? JSON.parse(raw) : {} };
  } catch {
    return { data: undefined, raw };
  }
}
