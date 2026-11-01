import { z } from "zod";
import { cleanupTestBoards } from "@/lib/cleanup";
import { ApiError, endpoint, parseInput, readJson, trialKeyOk } from "@/lib/http";

// Test runs delete their own board afterwards: {"url":"https://test.awkwardboard.com/…"}, or {"all":true}
// for every test board. Keyed with TRIAL_KEY; only boards under test.awkwardboard.com can be deleted.
const input = z.union([z.object({ url: z.string().min(1) }), z.object({ all: z.literal(true) })]);

export const POST = endpoint("/api/trial/cleanup", async (req, log) => {
  if (!trialKeyOk(req)) throw new ApiError("not_found", "Not found.", 404);
  return cleanupTestBoards(parseInput(input, await readJson(req, log)));
});
