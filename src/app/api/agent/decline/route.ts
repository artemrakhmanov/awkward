import { endpoint, parseInput, preflight, readJson, unauthorized } from "@/lib/http";
import { declineMatch } from "@/lib/inbox";
import { matchIdInput } from "@/lib/schemas";
import { agentAuth } from "@/lib/tokens";

export const OPTIONS = preflight;

export const POST = endpoint("/api/agent/decline", async (req, log) => {
  const { token, via } = agentAuth(req);
  Object.assign(log, { token, via });
  const { match_id } = parseInput(matchIdInput, await readJson(req, log));
  if (!token) throw unauthorized();
  return declineMatch("agent", token, match_id);
});
