import "server-only";
import { experimental_decide } from "ai";
import { decisionModel } from "@/lib/ai";
import { CONTACT_LABELS, findContactInfo } from "@/lib/contact";

export { findContactInfo, scrubContactInfo } from "@/lib/contact";

export type GuardResult =
  | { ok: true; skipped: boolean }
  | { ok: false; code: "contact_in_summary" | "identity_in_summary"; found: string };

const DECIDE_TIMEOUT_MS = 4000;
const IDENTITY_THRESHOLD = 0.6;

// One Decisions call, one yes/no question per kind of leak, so the error can say what to remove.
// Links are left to the regex: a "profile link" question fired on names and addresses too.
const IDENTITY_QUESTIONS = {
  name: {
    type: "boolean",
    instructions: "Does this public post include a person's name, surname or nickname?",
    criteria: { false: "\"My human\", roles, place names and event names are not a person's name." },
  },
  address: {
    type: "boolean",
    instructions: "Does this public post give an exact address: a house or flat number with a street, or a full postcode?",
    criteria: { false: "Areas, neighbourhoods, stations, towns and venues are not exact addresses." },
  },
  contact: {
    type: "boolean",
    instructions:
      "Does this public post give a way to contact someone directly: a phone number, email, social or messaging username, even if spelled out or disguised?",
  },
} as const;

const IDENTITY_LABELS: Record<keyof typeof IDENTITY_QUESTIONS, string> = {
  name: "a name",
  address: "an exact address",
  contact: "contact details",
};

export async function checkPublicSummary(text: string): Promise<GuardResult> {
  const kinds = findContactInfo(text);
  if (kinds.length) {
    return { ok: false, code: "contact_in_summary", found: `It contains ${kinds.map((k) => CONTACT_LABELS[k]).join(" and ")}` };
  }

  // GUARD_DECIDE=off is the kill switch for the AI layer.
  if (process.env.GUARD_DECIDE === "off") return { ok: true, skipped: true };

  try {
    const { answers } = await experimental_decide({
      model: decisionModel,
      state: text,
      questions: IDENTITY_QUESTIONS,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(DECIDE_TIMEOUT_MS),
    });
    const hits = (Object.keys(IDENTITY_QUESTIONS) as (keyof typeof IDENTITY_QUESTIONS)[]).filter(
      (k) => answers[k].probability >= IDENTITY_THRESHOLD,
    );
    if (hits.length) {
      return {
        ok: false,
        code: "identity_in_summary",
        found: `It looks like it contains ${hits.map((k) => IDENTITY_LABELS[k]).join(" and ")}`,
      };
    }
    return { ok: true, skipped: false };
  } catch {
    return { ok: true, skipped: true }; // fail soft: the regex passed
  }
}
