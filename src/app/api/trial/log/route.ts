import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { apiError, json } from "@/lib/http";
import { readTrialLog } from "@/lib/trial";

function keyMatches(given: string | null) {
  const expected = process.env.TRIAL_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  await connection();
  if (!keyMatches(new URL(req.url).searchParams.get("key"))) {
    return apiError("not_found", "Not found.", 404);
  }
  return json(await readTrialLog(100));
}
