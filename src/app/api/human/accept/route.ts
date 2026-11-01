import { ApiError, endpoint, parseInput, preflight, readJson } from "@/lib/http";
import { acceptMatch } from "@/lib/inbox";
import { acceptInput } from "@/lib/schemas";
import { bearer } from "@/lib/tokens";

export const OPTIONS = preflight;

export const POST = endpoint("/api/human/accept", async (req, log) => {
  const token = bearer(req);
  Object.assign(log, { token, via: token ? "header" : "none" });
  const input = parseInput(acceptInput, await readJson(req, log));
  log.body = { match_id: input.match_id, channel: input.channel }; // never log the contact details
  if (!token) throw new ApiError("unauthorized", "Send Authorization: Bearer <human token>.", 401);
  return acceptMatch(token, input);
});
