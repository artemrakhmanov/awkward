import { connection } from "next/server";
import { apiError, json, readEventLog, trialKeyOk } from "@/lib/http";

// The server-side event log, for us and the e2e runs (specs/e2e.md). Keyed; 404 otherwise.
export async function GET(req: Request) {
  await connection();
  if (!trialKeyOk(req)) return apiError("not_found", "Not found.", 404);
  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit")) || 100, 1), 1000);
  return json(await readEventLog(limit));
}
