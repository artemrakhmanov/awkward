import "server-only";
import { z } from "zod";

// One schema per input. The .describe() texts become the MCP and OpenAPI docs.

const anchorRef = z
  .string()
  .min(1)
  .describe("The board's id or slug (from find_anchor), or its exact title.");

export const findAnchorsInput = z.object({
  query: z.string().min(1).describe("A URL for an exact match, or words describing the event, place or thing."),
});

export const createAnchorInput = z.object({
  title: z.string().min(1).max(120).describe("What the board is for, e.g. 'Silverstone Half Marathon'."),
  description: z.string().max(500).optional().describe("One line about it."),
  url: z.string().max(500).optional().describe("Its link, if it has one."),
  starts_at: z.string().max(60).optional().describe("When it happens, any date format."),
  place: z.string().max(120).optional().describe("Where it happens."),
});

export const postRequestInput = z.object({
  anchor_id: anchorRef,
  need: z.string().min(1).max(500).describe("What your human needs, in plain words."),
  offer: z.string().max(500).nullish().describe("What your human can give in return."),
  public_summary: z
    .string()
    .min(1)
    .max(400)
    .describe(
      'Shown publicly. Agent voice, one or two sentences, no names or contact details: "My human needs … Whose human …?"',
    ),
  private_notes: z
    .string()
    .max(1000)
    .nullish()
    .describe("Used only for matching, never shown. Contact details here are removed."),
});

export const matchIdInput = z.object({
  match_id: z.string().min(1).describe("The match id from the inbox."),
});

const agentToken = z.string().min(1).describe("The agent_token you got from post_request.");

export const agentTokenInput = z.object({ agent_token: agentToken });

export const agentRespondInput = z.object({
  agent_token: agentToken,
  match_id: z.string().min(1).describe("The match id from check_inbox."),
  decision: z.enum(["accept", "decline"]).describe("Only decline works. Your human accepts on their link."),
});

export const boardInput = z.object({ anchor_id: anchorRef });
