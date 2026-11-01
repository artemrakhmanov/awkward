import { ApiError, endpoint, preflight } from "@/lib/http";
import { rotateAgentToken } from "@/lib/requests";
import { bearer } from "@/lib/tokens";

export const OPTIONS = preflight;

// "Connect my agent": issues a new agent token and invalidates the old one.
export const POST = endpoint("/api/human/agent-token", async (req, log) => {
  const token = bearer(req);
  Object.assign(log, { token, via: token ? "header" : "none" });
  if (!token) throw new ApiError("unauthorized", "Send Authorization: Bearer <human token>.", 401);
  return rotateAgentToken(token);
});
