import { endpoint, parseInput, preflight, readJson } from "@/lib/http";
import { type PostMeta, postRequest } from "@/lib/requests";
import { postRequestInput } from "@/lib/schemas";

export const maxDuration = 60;
export const OPTIONS = preflight;

export const POST = endpoint("/api/requests", async (req, log) => {
  const meta: PostMeta = {};
  try {
    return await postRequest(parseInput(postRequestInput, await readJson(req, log)), { source: "api", meta });
  } finally {
    log.token = meta.agentToken; // req_ref ties later inbox calls to this post
  }
});
