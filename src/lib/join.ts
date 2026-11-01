import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { textModel } from "@/lib/ai";
import { scrubContactInfo } from "@/lib/contact";
import { ApiError } from "@/lib/http";
import { postRequest } from "@/lib/requests";
import type { JoinResult } from "@/lib/types";

const REWRITE = `Rewrite this person's message as a post their agent would write.
need: what they need, in plain words. offer: what they can give, or an empty string.
public_summary: one or two sentences, agent voice, "My human … Whose human …?", no names, contact details or private details.
private_notes: anything personal or logistical (times, meeting points), or an empty string.
Drop any contact details entirely. Plain text, no em dashes.`;

const schema = z.object({ need: z.string(), offer: z.string(), public_summary: z.string(), private_notes: z.string() });

// The web form: free text in, a post out. The human gets their link; an agent token can be issued later from /r.
export async function postFromWeb({ anchor_slug, text }: { anchor_slug: string; text: string }): Promise<JoinResult> {
  const fallback = { need: text, offer: "", public_summary: `My human says: ${scrubContactInfo(text).slice(0, 160)}`, private_notes: "" };
  let post = fallback;
  try {
    const { output } = await generateText({ model: textModel, instructions: REWRITE, output: Output.object({ schema }), prompt: text });
    if (output.need.trim() && output.public_summary.trim()) post = output;
  } catch (e) {
    console.error("join rewrite failed", e instanceof Error ? e.message : "unknown");
  }

  const submit = (p: typeof post) =>
    postRequest(
      { anchor_id: anchor_slug, need: p.need, offer: p.offer || null, public_summary: p.public_summary, private_notes: p.private_notes || null },
      { source: "web" },
    );
  let result;
  try {
    result = await submit(post);
  } catch (e) {
    // The guard rejected the rewrite: retry once with the scrubbed original.
    if (!(e instanceof ApiError) || post === fallback || !e.code.endsWith("_in_summary")) throw e;
    result = await submit(fallback);
  }
  const { human_link, request_id, matches_found } = result;
  return { human_link, request_id, matches_found };
}
