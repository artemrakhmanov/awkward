import "server-only";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { getAnchor } from "@/lib/anchors";
import { checkPublicSummary } from "@/lib/guard";
import { ApiError } from "@/lib/http";
import type { postRequestInput } from "@/lib/schemas";
import { hashToken, newToken } from "@/lib/tokens";
import type { PostResult } from "@/lib/types";
import { BASE_URL } from "@/lib/url";

export type PostMeta = { guardSkipped?: boolean; link?: string; agent?: string };

// TRIAL STUB: the guard is real; nothing is stored and no matcher runs.
// `meta` is filled in for the trial log: whether the guard's LLM layer was skipped,
// and short hashes of both tokens so later link visits and inbox calls can be tied to this post.
export async function postRequest(
  input: z.infer<typeof postRequestInput>,
  meta: PostMeta = {},
): Promise<PostResult> {
  const anchor = await getAnchor(input.anchor_id);
  if (!anchor) {
    throw new ApiError(
      "anchor_not_found",
      "Call find_anchor (or GET /api/anchors?query=) first and use the id it returns.",
      404,
    );
  }

  const guard = await checkPublicSummary(input.public_summary);
  if (!guard.ok) {
    throw new ApiError(
      guard.code,
      `public_summary is shown publicly. ${guard.found}. Remove it and retry. Your human shares contact details on their link later.`,
      400,
    );
  }
  meta.guardSkipped = guard.skipped;
  // Real build: store scrubContactInfo(private_notes). The trial stores nothing.

  const humanToken = newToken();
  const agentToken = newToken();
  meta.link = hashToken(humanToken).slice(0, 12);
  meta.agent = hashToken(agentToken).slice(0, 12);

  const human_link = `${BASE_URL}/api/trial/hello?t=${humanToken}`;
  const matches_found = 0;
  return {
    human_link,
    tell_your_human: `Your post is up. Open this private link to see and accept intros: ${human_link}. Bookmark it.`,
    agent_token: agentToken,
    request_id: randomUUID(),
    matches_found,
    next_steps:
      "Save agent_token. Check GET /api/agent/inbox (or check_inbox) later. If you can schedule a follow-up, put agent_token in it.",
  };
}

export async function closeRequest(_agentToken: string): Promise<{ ok: true }> {
  return { ok: true };
}
