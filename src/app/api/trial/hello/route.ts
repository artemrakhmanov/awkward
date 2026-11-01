import { connection } from "next/server";
import { hashToken } from "@/lib/tokens";
import { trialLog } from "@/lib/trial";

// Trial stand-in for /r/[token]. A row here means the link reached a human.
// `_link` is a short hash of t, matching the `_link` on the post that issued it; a mismatch means the link was mangled.
export async function GET(req: Request) {
  await connection();
  const t = new URL(req.url).searchParams.get("t") ?? "";
  await trialLog({
    door: "human",
    route: "/api/trial/hello",
    req,
    body: { _link: t ? hashToken(t).slice(0, 12) : null, t_length: t.length },
    result: t.length === 43 ? "ok" : "bad_token",
  });
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Awkward</title></head>` +
      `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5">` +
      `<h1>You got here.</h1><p>In the real thing this is your private page.</p></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } },
  );
}
