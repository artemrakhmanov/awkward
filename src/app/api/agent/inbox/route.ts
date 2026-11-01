import { connection } from "next/server";
import { apiError, errorResponse, json, preflight } from "@/lib/http";
import { getAgentInbox } from "@/lib/inbox";
import { agentAuth } from "@/lib/tokens";
import { trialLog } from "@/lib/trial";

export const OPTIONS = preflight;

export async function GET(req: Request) {
  await connection();
  const { token, via } = agentAuth(req, true);
  if (!token) {
    await trialLog({ door: "http", route: "/api/agent/inbox", req, auth_via: via, result: "unauthorized" });
    return apiError("unauthorized", "Send Authorization: Bearer <agent_token>.", 401);
  }
  try {
    const result = await getAgentInbox(token);
    await trialLog({ door: "http", route: "/api/agent/inbox", req, auth_via: via, result: "ok" });
    return json(result);
  } catch (e) {
    await trialLog({ door: "http", route: "/api/agent/inbox", req, auth_via: via, result: "server_error" });
    return errorResponse(e);
  }
}
