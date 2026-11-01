import { endpoint, parseInput, preflight, readJson } from "@/lib/http";
import { postFromWeb } from "@/lib/join";
import { joinInput } from "@/lib/schemas";

export const maxDuration = 60;
export const OPTIONS = preflight;

export const POST = endpoint("/api/join", async (req, log) => {
  return postFromWeb(parseInput(joinInput, await readJson(req, log)));
});
