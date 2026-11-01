import "server-only";
import type { z } from "zod";

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
