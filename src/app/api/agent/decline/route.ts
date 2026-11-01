import { ApiError, apiError, errorResponse, json, parseInput, preflight } from "@/lib/http";
import { declineMatch } from "@/lib/inbox";
import { matchIdInput } from "@/lib/schemas";
import { agentAuth } from "@/lib/tokens";
import { readBody, tokenTag, trialLog } from "@/lib/trial";

export const OPTIONS = preflight;

export async function POST(req: Request) {
  const { token, via } = agentAuth(req);
  const { data, raw } = await readBody(req);
  const body = { ...((data as object | undefined) ?? { raw }), _agent: tokenTag(token) };
  if (!token) {
    await trialLog({ door: "http", route: "/api/agent/decline", req, auth_via: via, body, result: "unauthorized" });
    return apiError("unauthorized", "Send Authorization: Bearer <agent_token>.", 401);
  }
  try {
    if (data === undefined) throw new ApiError("invalid", "Send a JSON body with Content-Type: application/json.", 400);
    const { match_id } = parseInput(matchIdInput, data);
    const result = await declineMatch("agent", token, match_id);
    await trialLog({ door: "http", route: "/api/agent/decline", req, auth_via: via, body, result: "ok" });
    return json(result);
  } catch (e) {
    await trialLog({ door: "http", route: "/api/agent/decline", req, auth_via: via, body, result: e instanceof ApiError ? e.code : "server_error" });
    return errorResponse(e);
  }
}
