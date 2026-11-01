import { ApiError, errorResponse, json, parseInput, preflight } from "@/lib/http";
import { type PostMeta, postRequest } from "@/lib/requests";
import { postRequestInput } from "@/lib/schemas";
import { readBody, trialLog } from "@/lib/trial";

export const maxDuration = 60;
export const OPTIONS = preflight;

export async function POST(req: Request) {
  const started = Date.now();
  const { data, raw } = await readBody(req);
  const meta: PostMeta = {};
  try {
    if (data === undefined) throw new ApiError("invalid", "Send a JSON body with Content-Type: application/json.", 400);
    const result = await postRequest(parseInput(postRequestInput, data), meta);
    await trialLog({
      door: "http",
      route: "/api/requests",
      req,
      body: { ...(data as object), _link: meta.link, _agent: meta.agent, _ms: Date.now() - started },
      result: meta.guardSkipped && process.env.GUARD_DECIDE === "on" ? "guard_skipped" : "ok",
    });
    return json(result);
  } catch (e) {
    await trialLog({
      door: "http",
      route: "/api/requests",
      req,
      body: data ?? { raw, content_type: req.headers.get("content-type") },
      result: e instanceof ApiError ? e.code : "server_error",
    });
    return errorResponse(e);
  }
}
