import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { textModel } from "@/lib/ai";
import { scrubContactInfo } from "@/lib/contact";
import { createAdminClient } from "@/lib/supabase/admin";

const MIN_SCORE = 0.6;
const MAX_MATCHES = 2;

const INSTRUCTIONS = `You match people who are posting on the same board. You get one request ("ME") and a list of candidates on the same board. A good match is one where meeting is clearly useful to both: one offers what the other needs, or both need the same thing and can share it (a ride, a cost, a team, a table). Be strict. Most candidates are not matches.
For each candidate, return good_match, score (0 to 1), reason and plan.
reason: one line, max 15 words, shown publicly, so it must not include names, contacts, exact addresses, times or anything that appears only in private notes. Example: "Both heading to Silverstone from east London; one has seats."
plan: one or two concrete sentences, shown only to these two people and their agents. Use private notes only as far as the plan needs them. Never include contact details. Example: "Pickup at Dalston Junction 6:15am, split fuel £15 each."
Plain text, no em dashes.`;

const schema = z.object({
  matches: z.array(
    z.object({
      candidate_id: z.string(),
      good_match: z.boolean(),
      score: z.number().min(0).max(1),
      reason: z.string(),
      plan: z.string(),
    }),
  ),
});

type Candidate = { id: string; public_summary: string; need: string; offer: string | null; private_notes: string | null };

const line = (c: Omit<Candidate, "id"> & { id?: string }) =>
  [c.id, c.public_summary, c.need, c.offer ?? "", c.private_notes ?? ""].filter((x) => x !== undefined).join(" | ");

// Proposes up to 2 matches for a new request. Returns the match ids it inserted.
export async function findMatches(requestId: string): Promise<{ id: string }[]> {
  const db = createAdminClient();
  const { data: me, error: meErr } = await db
    .from("requests")
    .select("anchor_id, public_summary, need, offer, private_notes")
    .eq("id", requestId)
    .single<Omit<Candidate, "id"> & { anchor_id: string }>();
  if (meErr) throw new Error(`load request failed: ${meErr.code}`);

  const { data: candidates, error } = await db.rpc("match_candidates", { p_request_id: requestId });
  if (error) throw new Error(`match_candidates failed: ${error.code}`);
  const pool = candidates as Candidate[];
  if (!pool.length) return [];

  const { output } = await generateText({
    model: textModel,
    instructions: INSTRUCTIONS,
    output: Output.object({ schema }),
    prompt: [
      "Format: id | public_summary | need | offer | private_notes",
      `ME: ${line({ ...me, id: undefined })}`,
      "CANDIDATES:",
      ...pool.map(line),
    ].join("\n"),
  });

  const ids = new Set(pool.map((c) => c.id));
  const picks = output.matches
    .filter((m) => ids.has(m.candidate_id) && m.good_match && m.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES);

  const inserted: { id: string }[] = [];
  for (const m of picks) {
    const { data, error: insErr } = await db
      .from("matches")
      .insert({
        anchor_id: me.anchor_id,
        req_a: requestId,
        req_b: m.candidate_id,
        // Safety net: the prompt forbids contact details; strip any that slip through.
        reason: scrubContactInfo(m.reason.trim()),
        plan: scrubContactInfo(m.plan.trim()),
      })
      .select("id")
      .single<{ id: string }>();
    if (insErr?.code === "23505") continue; // this pair already has a match
    if (insErr) throw new Error(`match insert failed: ${insErr.code}`);
    inserted.push(data);
  }
  return inserted;
}
