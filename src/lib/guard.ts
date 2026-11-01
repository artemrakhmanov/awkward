import "server-only";
import { decide } from "@/lib/decide";

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

export async function checkPublicSummary(text: string): Promise<GuardResult> {
  const kinds = findContactInfo(text);
  if (kinds.length) {
    return { ok: false, code: "contact_in_summary", found: `It contains ${kinds.map((k) => LABELS[k]).join(" and ")}` };
  }

  // Trial: the LLM layer is off unless GUARD_DECIDE=on (no AI spend during the trial).
  if (process.env.GUARD_DECIDE !== "on") return { ok: true, skipped: true };

  try {
    const d = await Promise.race([
      decide({
        question:
          "Does this public post reveal who the person is or how to reach them: a name, phone, email, social handle, exact address or profile link?",
        options: ["safe", "reveals identity"],
        context: text,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), DECIDE_TIMEOUT_MS)),
    ]);
    if (d.choice === "reveals identity" && d.confidence >= 0.6) {
      return { ok: false, code: "identity_in_summary", found: d.reasoning };
    }
    return { ok: true, skipped: false };
  } catch {
    return { ok: true, skipped: true }; // fail soft: the regex passed
  }
}
