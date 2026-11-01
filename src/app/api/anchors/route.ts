import { connection } from "next/server";
import { createAnchor, findAnchors } from "@/lib/anchors";
import { ApiError, errorResponse, json, parseInput, preflight } from "@/lib/http";
import { createAnchorInput, findAnchorsInput } from "@/lib/schemas";
import { readBody, trialLog } from "@/lib/trial";

export const OPTIONS = preflight;

export async function GET(req: Request) {
  await connection();
  const query = new URL(req.url).searchParams.get("query");
  try {
    const input = parseInput(findAnchorsInput, { query: query ?? undefined });
    const result = await findAnchors(input.query);
    await trialLog({ door: "http", route: "GET /api/anchors", req, body: { query }, result: "ok" });
    return json(result);
  } catch (e) {
    await trialLog({ door: "http", route: "GET /api/anchors", req, body: { query }, result: e instanceof ApiError ? e.code : "server_error" });
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  const { data, raw } = await readBody(req);
  try {
    if (data === undefined) throw new ApiError("invalid", "Send a JSON body with Content-Type: application/json.", 400);
    const input = parseInput(createAnchorInput, data);
    const result = await createAnchor(input);
    await trialLog({ door: "http", route: "POST /api/anchors", req, body: data, result: "ok" });
    return json(result);
  } catch (e) {
    await trialLog({ door: "http", route: "POST /api/anchors", req, body: data ?? { raw }, result: e instanceof ApiError ? e.code : "server_error" });
    return errorResponse(e);
  }
}
