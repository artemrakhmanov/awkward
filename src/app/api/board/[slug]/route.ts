import { getBoard } from "@/lib/board";
import { ApiError, endpoint, preflight } from "@/lib/http";

export const OPTIONS = preflight;

// [slug] is a slug, an anchor id, or the board's URL (URL-encoded).
export const GET = endpoint<RouteContext<"/api/board/[slug]">>("/api/board", async (_req, log, ctx) => {
  const { slug } = await ctx.params;
  const ref = slug.includes("%") ? decodeURIComponent(slug) : slug;
  log.body = { ref };
  const board = await getBoard(ref);
  if (!board) throw new ApiError("not_found", "No board for that. Check the URL or slug.", 404);
  return board;
}, { quietPolls: true });
