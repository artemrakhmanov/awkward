import "server-only";

// Contact-detail patterns for the public_summary guard and private_notes scrubbing. Pure, so it can be unit tested.

export type ContactKind = "email" | "phone" | "handle" | "url";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
// Candidate runs of digits with spaces, +, -, (). Counted as a phone at 7+ digits, unless it reads as a date.
const PHONE = /\+?\(?\d[\d\s()-]{5,}\d/g;
const DATE = /^\d{4}-\d{1,2}-\d{1,2}$|^\d{1,2}-\d{1,2}-\d{2,4}$/;
const HANDLE = /(?<![\w.])@[A-Za-z0-9_][A-Za-z0-9_.]{1,}/g;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[\w-]+\.(?:com|co\.uk|uk|io|me|net|org|app|dev|ly|gg|xyz|link|page)\b(?:\/\S*)?/gi;

export const CONTACT_LABELS: Record<ContactKind, string> = {
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
