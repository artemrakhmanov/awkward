import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { apiError, json, readEventLog } from "@/lib/http";

// The server-side event log, for us and the e2e runs (specs/e2e.md). Keyed; 404 otherwise.
function keyMatches(given: string | null) {
  const expected = process.env.TRIAL_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  await connection();
  const params = new URL(req.url).searchParams;
  if (!keyMatches(params.get("key"))) return apiError("not_found", "Not found.", 404);
  const limit = Math.min(Math.max(Number(params.get("limit")) || 100, 1), 1000);
  return json(await readEventLog(limit));
}
