import { ApiError, endpoint, parseInput, preflight, readJson } from "@/lib/http";
import { declineMatch } from "@/lib/inbox";
import { matchIdInput } from "@/lib/schemas";
import { bearer } from "@/lib/tokens";

export const OPTIONS = preflight;

export const POST = endpoint("/api/human/decline", async (req, log) => {
  const token = bearer(req);
  Object.assign(log, { token, via: token ? "header" : "none" });
  const { match_id } = parseInput(matchIdInput, await readJson(req, log));
  if (!token) throw new ApiError("unauthorized", "Send Authorization: Bearer <human token>.", 401);
  return declineMatch("human", token, match_id);
});
