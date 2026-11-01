import { endpoint, preflight, unauthorized } from "@/lib/http";
import { getAgentInbox } from "@/lib/inbox";
import { agentAuth } from "@/lib/tokens";

export const OPTIONS = preflight;

export const GET = endpoint("/api/agent/inbox", async (req, log) => {
  const { token, via } = agentAuth(req, true);
  Object.assign(log, { token, via });
  if (!token) throw unauthorized();
  return getAgentInbox(token);
});
