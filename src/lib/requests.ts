import "server-only";
import type { z } from "zod";
import { embedText, getAnchor } from "@/lib/anchors";
import { checkPublicSummary, scrubContactInfo } from "@/lib/guard";
import { ApiError, expired } from "@/lib/http";
import { findMatches } from "@/lib/matcher";
import type { postRequestInput } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, newToken, resolveAgent, resolveHuman } from "@/lib/tokens";
import type { AgentTokenResult, PostResult } from "@/lib/types";
import { BASE_URL } from "@/lib/url";

const DAY = 24 * 60 * 60 * 1000;

export const humanLink = (token: string) => `${BASE_URL}/r/${token}`;

export const badAgentToken = () =>
  new ApiError(
    "unauthorized",
    "That agent_token isn't recognised. Send the agent_token you got when you posted, as Authorization: Bearer <agent_token>.",
    401,
  );
export const badHumanToken = () => new ApiError("unauthorized", "That link isn't recognised. Check it was copied in full.", 401);

// Filled in for the event log: the new agent token (logged only as a short hash), and whether the guard's AI layer ran.
export type PostMeta = { agentToken?: string; guardSkipped?: boolean };

export async function postRequest(
  input: z.infer<typeof postRequestInput>,
  { source, skipMatch = false, meta = {} }: { source: "api" | "mcp" | "web"; skipMatch?: boolean; meta?: PostMeta },
): Promise<PostResult> {
  const anchor = await getAnchor(input.anchor_id);
  if (!anchor) {
    throw new ApiError(
      "anchor_not_found",
      "No board for that. Pass the event's own URL as anchor_id, or call find_anchor (GET /api/anchors?query=) and use an id it returns. If there's no board yet, create it with POST /api/anchors.",
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

  const offer = input.offer?.trim() || null;
  const [need_emb, offer_emb] = await Promise.all([embedText(input.need), offer ? embedText(offer) : null]);

  const agentToken = newToken();
  const humanToken = newToken();
  meta.agentToken = agentToken;

  // Expires a day after the event if it's still ahead, otherwise in 14 days.
  const afterEvent = anchor.starts_at ? new Date(anchor.starts_at).getTime() + DAY : 0;
  const expires_at = new Date(afterEvent > Date.now() ? afterEvent : Date.now() + 14 * DAY).toISOString();

  const { data, error } = await createAdminClient()
    .from("requests")
    .insert({
      anchor_id: anchor.id,
      public_summary: input.public_summary.trim(),
      need: input.need.trim(),
      offer,
      private_notes: input.private_notes ? scrubContactInfo(input.private_notes.trim()) : null,
      need_emb,
      offer_emb,
      agent_token_hash: hashToken(agentToken),
      human_token_hash: hashToken(humanToken),
      expires_at,
      source,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(`request insert failed: ${error.code}`);

  // Fail soft: the post always succeeds, even if matching doesn't.
  let matches_found = 0;
  if (!skipMatch && need_emb) {
    try {
      matches_found = (await findMatches(data.id)).length;
    } catch (e) {
      console.error("matcher failed", data.id, e instanceof Error ? e.message : "unknown");
    }
  }

  const human_link = humanLink(humanToken);
  return {
    human_link,
    tell_your_human:
      `Your post is up. Open this private link to see and accept intros: ${human_link}. Bookmark it.` +
      (matches_found > 0 ? " There's already a possible match waiting for you." : ""),
    agent_token: agentToken,
    request_id: data.id,
    matches_found,
    next_steps:
      "Save agent_token. Check GET /api/agent/inbox (or check_inbox) later. If you can schedule a follow-up, put agent_token in it.",
  };
}

export async function closeRequest(agentToken: string): Promise<{ ok: true }> {
  const me = await resolveAgent(agentToken);
  if (!me) throw badAgentToken();
  if (me === "expired") throw expired();
  const { error } = await createAdminClient().from("requests").update({ status: "closed" }).eq("id", me.id);
  if (error) throw new Error(`close failed: ${error.code}`);
  return { ok: true };
}

// The old agent token stops working.
export async function rotateAgentToken(humanToken: string): Promise<AgentTokenResult> {
  const me = await resolveHuman(humanToken);
  if (!me) throw badHumanToken();
  if (me === "expired") throw expired();
  const agent_token = newToken();
  const { error } = await createAdminClient()
    .from("requests")
    .update({ agent_token_hash: hashToken(agent_token) })
    .eq("id", me.id);
  if (error) throw new Error(`rotate failed: ${error.code}`);
  return { agent_token };
}
