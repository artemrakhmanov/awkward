import { z } from "zod";
import { cleanupTestBoards } from "@/lib/cleanup";
import { ApiError, endpoint, parseInput, readJson, trialKeyOk } from "@/lib/http";

// Test runs delete their own board afterwards: {"url":"https://test.awkwardboard.com/…"}, {"all":true} for every
// test board, or {"id":"<uuid>"} for a stray board an agent made during a run (no URL or a test URL, under 6h old).
// Keyed with TRIAL_KEY. A board with a real URL can never be deleted here.
const input = z.union([z.object({ url: z.string().min(1) }), z.object({ id: z.uuid() }), z.object({ all: z.literal(true) })]);

export const POST = endpoint("/api/trial/cleanup", async (req, log) => {
  if (!trialKeyOk(req)) throw new ApiError("not_found", "Not found.", 404);
  return cleanupTestBoards(parseInput(input, await readJson(req, log)));
});
