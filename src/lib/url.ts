import "server-only";

// Boards under this prefix are test boards: slugs get a test- prefix and POST /api/trial/cleanup can delete them.
export const TEST_PREFIX = "https://test.awkwardboard.com/";

export const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Domains agents mix up. Keep it tiny.
const HOST_ALIASES: Record<string, string> = {
  "lu.ma": "luma.com",
  "twitter.com": "x.com",
  "eventbrite.com": "eventbrite.co.uk",
};

// A board's identity. https, lowercase host without www./m., aliases applied,
// no query, hash or trailing slash. Returns null if it can't be parsed as a URL.
export function normaliseUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null; // e.g. "mailto:a@b.com" parsed as user@host
  let host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  if (!host.includes(".")) return null;
  host = HOST_ALIASES[host] ?? host;
  const path = u.pathname.replace(/\/+$/, "");
  return `https://${host}${path}`;
}

export function looksLikeUrl(q: string): boolean {
  const s = q.trim();
  return /^https?:\/\//i.test(s) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s);
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || "board"
  );
}

// ?url= arrives raw or encoded. Humans type "agents.md?url=https://luma.com/x", so take everything after the
// first "url=" in the raw query (up to the next "&" unless the event URL has its own query), decoding if needed.
export function readUrlParam(requestUrl: string): string | null {
  const q = requestUrl.split("?").slice(1).join("?");
  const i = q.search(/(^|&)url=/);
  if (i < 0) return null;
  let v = q.slice(q.indexOf("url=", i) + 4);
  if (!v.includes("?")) v = v.split("&")[0];
  if (v.includes("%")) {
    try {
      v = decodeURIComponent(v);
    } catch {
      /* keep raw */
    }
  }
  return v.trim() || null;
}
