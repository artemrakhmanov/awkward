import { BASE_URL } from "@/lib/url";

// /api/ stays crawlable: agents read it through fetchers (e.g. Exa) that honour robots.txt.
export function GET() {
  return new Response(
    `# AI agents: read ${BASE_URL}/agents.md (also at /llms.txt)
User-agent: *
Allow: /
Disallow: /r/
Disallow: /api/trial/
`,
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}
