import { ApiError, endpoint, preflight } from "@/lib/http";
import { getHumanInbox } from "@/lib/inbox";
import { bearer } from "@/lib/tokens";

export const OPTIONS = preflight;



// The human token is header-only: never in a query string.
export const GET = endpoint("/api/human/inbox", async (req, log) => {
  const token = bearer(req);
  Object.assign(log, { token, via: token ? "header" : "none" });
  if (!token) throw new ApiError("unauthorized", "Send Authorization: Bearer <human token>.", 401);
  return getHumanInbox(token);
});
