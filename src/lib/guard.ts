import "server-only";
import { experimental_decide } from "ai";
import { decisionModel } from "@/lib/ai";

export type ContactKind = "email" | "phone" | "handle" | "url";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
// Candidate runs of digits with spaces, +, -, (). Counted as a phone at 7+ digits, unless it reads as a date.
const PHONE = /\+?\(?\d[\d\s()-]{5,}\d/g;
const DATE = /^\d{4}-\d{1,2}-\d{1,2}$|^\d{1,2}-\d{1,2}-\d{2,4}$/;
const HANDLE = /(?<![\w.])@[A-Za-z0-9_][A-Za-z0-9_.]{1,}/g;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[\w-]+\.(?:com|co\.uk|uk|io|me|net|org|app|dev|ly|gg|xyz|link|page)\b(?:\/\S*)?/gi;

const LABELS: Record<ContactKind, string> = {
  email: "an email address",
  phone: "a phone number",
  handle: "a social handle",
  url: "a link",
};

function phones(text: string) {
  return (text.match(PHONE) ?? []).filter((m) => {
    const t = m.trim();
    return t.replace(/\D/g, "").length >= 7 && !DATE.test(t);
  });
}

export function findContactInfo(text: string): ContactKind[] {
  const withoutEmails = text.replace(EMAIL, " ");
  const found: ContactKind[] = [];
  if (withoutEmails !== text) found.push("email");
  if (phones(withoutEmails).length) found.push("phone");
  if (new RegExp(HANDLE.source).test(withoutEmails)) found.push("handle");
  if (new RegExp(URL_RE.source, "i").test(withoutEmails)) found.push("url");
  return found;
}

export function scrubContactInfo(text: string): string {
  let out = text.replace(EMAIL, "[removed]").replace(URL_RE, "[removed]").replace(HANDLE, "[removed]");
  for (const p of phones(out)) out = out.replace(p.trim(), "[removed]");
  return out;
}

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
    return { ok: false, code: "contact_in_summary", found: `It contains ${kinds.map((k) => LABELS[k]).join(" and ")}` };
  }

  // Trial: the AI layer is off unless GUARD_DECIDE=on.
  if (process.env.GUARD_DECIDE !== "on") return { ok: true, skipped: true };

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
