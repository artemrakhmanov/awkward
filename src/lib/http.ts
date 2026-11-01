import "server-only";
import { connection } from "next/server";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { type AuthVia, hashToken } from "@/lib/tokens";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

// Thrown by lib functions. REST turns it into apiError(), MCP into fail(message).
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export const unauthorized = () => new ApiError("unauthorized", "Send Authorization: Bearer <agent_token>.", 401);
export const expired = () => new ApiError("expired", "This request has expired.", 410);

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { ...CORS, "cache-control": "no-store" } });
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}

export function apiError(code: string, message: string, status: number) {
  return json({ error: code, message }, status);
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return apiError(e.code, e.message, e.status);
  console.error("unhandled error", e instanceof Error ? e.message : "unknown");
  return apiError("server_error", "Something went wrong on our side. Retry once.", 500);
}

// Loose parse: unknown keys are ignored, and errors name the fields in plain words.
export function parseInput<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const parsed = schema.safeParse(data);
  if (parsed.success) return parsed.data;
  const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "body"))];
  throw new ApiError(
    "invalid",
    `Fix these fields and retry: ${fields.join(", ")}. Send JSON with Content-Type: application/json.`,
    400,
  );
}

// ---- Event log (trial_log). The e2e evals read the server side of every run from it (specs/e2e.md).

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

// First 8 hex of sha256(token): ties log rows to one request without storing the token.
export const tokenRef = (t: string | null | undefined) => (t ? hashToken(t).slice(0, 8) : null);

export type LogFields = { token?: string | null; via?: AuthVia; body?: unknown };

// Never throws: a logging failure must not break a request.
export async function logEvent(row: { door: Door; route: string; req?: Request; result: string } & LogFields) {
  try {
    const { error } = await createAdminClient()
      .from("trial_log")
      .insert({
        door: row.door,
        route: row.route,
        user_agent: row.req?.headers.get("user-agent") ?? null,
        auth_via: row.via ?? "none",
        body: row.body === undefined ? null : stripTokens(row.body),
        result: row.result,
        req_ref: tokenRef(row.token),
      });
    if (error) console.error("logEvent insert failed", error.message);
  } catch (e) {
    console.error("logEvent insert failed", e instanceof Error ? e.message : "unknown");
  }
}

export async function readEventLog(limit = 100) {
  const { data, error } = await createAdminClient()
    .from("trial_log")
    .select("id, at, door, route, user_agent, auth_via, body, result, req_ref")
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data;
}

// ---- Route wrapper: logs every call once (with its result) and turns ApiErrors into JSON errors.

export type Ctx = LogFields & { status?: number };

export function endpoint<C = unknown>(route: string, fn: (req: Request, log: Ctx, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    await connection();
    const log: Ctx = {};
    try {
      const out = await fn(req, log, ctx);
      await logEvent({ door: "http", route, req, result: "ok", ...log });
      return json(out, log.status ?? 200);
    } catch (e) {
      await logEvent({ door: "http", route, req, result: e instanceof ApiError ? e.code : "server_error", ...log });
      return errorResponse(e);
    }
  };
}

// Reads a JSON body into log.body. Invalid JSON keeps the raw text in the log so we can see what was sent.
export async function readJson(req: Request, log: Ctx): Promise<unknown> {
  const raw = await req.text();
  try {
    const data: unknown = raw ? JSON.parse(raw) : {};
    log.body = data;
    return data;
  } catch {
    log.body = { raw, content_type: req.headers.get("content-type") };
    throw new ApiError("invalid", "Send a JSON body with Content-Type: application/json.", 400);
  }
}
