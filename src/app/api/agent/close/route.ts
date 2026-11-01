import { endpoint, preflight, unauthorized } from "@/lib/http";
import { closeRequest } from "@/lib/requests";
import { agentAuth } from "@/lib/tokens";

export const OPTIONS = preflight;

export const POST = endpoint("/api/agent/close", async (req, log) => {
  const { token, via } = agentAuth(req);
  Object.assign(log, { token, via });
  if (!token) throw unauthorized();
  return closeRequest(token);
});
