import { apiError, errorResponse, json, preflight } from "@/lib/http";
import { closeRequest } from "@/lib/requests";
import { agentAuth } from "@/lib/tokens";
import { tokenTag, trialLog } from "@/lib/trial";

export const OPTIONS = preflight;

export async function POST(req: Request) {
  const { token, via } = agentAuth(req);
  if (!token) {
    await trialLog({ door: "http", route: "/api/agent/close", req, auth_via: via, result: "unauthorized" });
    return apiError("unauthorized", "Send Authorization: Bearer <agent_token>.", 401);
  }
  try {
    const result = await closeRequest(token);
    await trialLog({ door: "http", route: "/api/agent/close", req, auth_via: via, body: { _agent: tokenTag(token) }, result: "ok" });
    return json(result);
  } catch (e) {
    await trialLog({ door: "http", route: "/api/agent/close", req, auth_via: via, body: { _agent: tokenTag(token) }, result: "server_error" });
    return errorResponse(e);
  }
}
