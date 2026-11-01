import { createAnchor, findAnchors } from "@/lib/anchors";
import { endpoint, parseInput, preflight, readJson } from "@/lib/http";
import { createAnchorInput, findAnchorsInput } from "@/lib/schemas";

export const OPTIONS = preflight;

export const GET = endpoint("GET /api/anchors", async (req, log) => {
  const query = new URL(req.url).searchParams.get("query");
  log.body = { query };
  return findAnchors(parseInput(findAnchorsInput, { query: query ?? undefined }).query);
});

export const POST = endpoint("POST /api/anchors", async (req, log) => {
  return createAnchor(parseInput(createAnchorInput, await readJson(req, log)));
});
