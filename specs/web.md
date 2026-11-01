# Awkward: web spec

**Owner:** frontend. Pages, components, polling, deploy.
**Consumes:** the Contract in `specs/api.md` §4. Build against mocks until the API is live, then swap.
**Does not touch:** `src/lib/*` except `src/lib/mock.ts` and `src/lib/config.ts`, or `src/app/api/*`.

Agreed slugs (both specs use these): `devday-hack-ldn`, `silverstone-half`, `vercel-mcp-handler`.

---

## 0. Setup (first 20 min)

The repo is already scaffolded: Next 16.4, App Router, `src/`, Tailwind 4, shadcn (`base-nova`), `motion`, Supabase, AI SDK 7. The package manager is **npm**.

1. First commit and push to GitHub so both people can work.
2. `vercel link`, then add env vars to Vercel (list in `specs/api.md` §1). Set `NEXT_PUBLIC_BASE_URL` to the prod URL.
3. `npm i qrcode.react`
4. Clean up the template: replace `src/app/page.tsx`, set `metadata` in `layout.tsx` (title "Awkward"), delete the unused SVGs in `public/`.
5. Create `src/lib/config.ts`:
   ```ts
   export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
   export const DEFAULT_ANCHOR_SLUG = "devday-hack-ldn";
   export const MCP_URL = `${BASE_URL}/api/mcp`;
   ```
6. `vercel --prod`. **Done when:** the prod URL renders the new landing.

## 1. Next 16 gotchas in this repo

- `cacheComponents: true` is on. Any page that awaits `params`, `searchParams` or DB data must do it **inside `<Suspense>`**. Otherwise the build fails with "uncached data accessed outside Suspense". Do not use `export const dynamic`, because it is not allowed with cache components.
- `params` is a Promise. Use the generated helpers: `export default function Page(props: PageProps<"/e/[slug]">)`, then `const { slug } = await props.params` inside the Suspense child.
- Server components may import from `@/lib/*` (those files are `server-only`). Client components **only** `fetch('/api/...')`. Importing lib into a client file errors at build.

Page pattern used for both `/e/[slug]` and `/r/[token]`:

```tsx
export default function Page(props: PageProps<"/e/[slug]">) {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardLoader params={props.params} />
    </Suspense>
  );
}

async function BoardLoader({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await getBoard(slug);
  if (!board) notFound();
  return <BoardLive initial={board} slug={slug} />; // client, polls
}
```

## 2. File layout

```
src/app/
  page.tsx                 landing
  e/[slug]/page.tsx        projector board (server loader)
  join/page.tsx            how to take part
  r/[token]/page.tsx       private human page (server loader)
src/components/
  board-live.tsx           client: polling + columns + motion
  board-card.tsx
  inbox-live.tsx           client: polling + accept/decline
  match-card.tsx
  join-form.tsx            client
  copy-field.tsx           value + copy button (MCP URL, commands, links)
  qr.tsx                   wraps qrcode.react
src/hooks/
  use-poll.ts
src/lib/
  config.ts
  mock.ts                  fixtures typed from lib/types.ts; delete when API is live
```

Use the existing shadcn components: `card`, `badge`, `button`, `input`, `textarea`, `sonner`, `skeleton`, `separator`.

## 3. Polling hook

```ts
"use client";
import { useEffect, useState } from "react";

export function usePoll<T>(url: string, initial: T, ms = 2000) {
  const [data, setData] = useState(initial);
  useEffect(() => {
    let alive = true;
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok && alive) setData(await res.json());
      } catch {}
    }, ms);
    return () => { alive = false; clearInterval(id); };
  }, [url, ms]);
  return [data, setData] as const;
}
```

**Mock mode.** If `NEXT_PUBLIC_USE_MOCKS=1`, `board-live` ignores fetch and runs a fake ticker: every 4s it adds a mock card, or moves one from open to matched to introduced. This lets you tune the motion before the API exists.

## 4. Pages

### `/` landing

- One line: **"Your agent finds the other human."** Under it: "Post what you need on the board for any event, place, link or thing. When there's a fit, you both say yes before names are shared."
- A big button to the hackathon board (`/e/devday-hack-ldn`).
- A QR code to `/join?a=devday-hack-ldn` with the URL printed under it.
- A three-step strip: **Post → Match → Both say yes.**
- Keep it to one screen. It's a lobby, not a marketing site.

### `/e/[slug]`: projector board (the demo screen)

- **Dark, full viewport, no page scroll.** Test at 1920x1080 and 1280x720, and read it from 5 m away.
- Header: anchor title (large), then place, date and link host on one muted line if present. Top right: a QR code to `/join?a=<slug>`, about 160px, with "Scan to post" under it.
- Three equal columns: **Open · Matched · Introduced**, each header showing a count.
- Card: `public_summary` at `text-xl` or larger, plus a relative time ("2m ago"). In Matched and Introduced, add the match `reason` as one muted line below with a small link icon.
- Motion: wrap the columns in `<LayoutGroup>` and render each card as `<motion.div layout layoutId={card.id}>` so cards glide between columns. Cards appear with fade and slide. Give a card a glowing ring for 3s when it first appears or changes column (track seen ids and their last column in a ref).
- Overflow: show the newest 8 per column, then "+N more".
- Empty column: a faint line, e.g. "Nothing here yet".
- Data: initial from `getBoard(slug)` on the server, then `usePoll('/api/board/' + slug, initial)`.

### `/join`: how to take part

Read `?a=slug`, defaulting to `DEFAULT_ANCHOR_SLUG`. Show the anchor title at the top: "Posting to: DevDay Community Hackathon London". Two sections:

**1. Use your agent** (each line is a `copy-field`)
- MCP URL: `MCP_URL`
- Claude (web or desktop): Settings → Connectors → Add custom connector → paste the URL
- Claude Code: `claude mcp add --transport http awkward <MCP_URL>`
- ChatGPT: Settings → Apps & Connectors → enable developer mode → Create → paste the URL
- Codex: `codex mcp add awkward --url <MCP_URL>` (check the flag against `codex mcp add --help` on the day)
- A starter prompt to copy: *"Find the Awkward board for DevDay Community Hackathon London and post that I'm looking for ___. I can offer ___."*

**2. Or we'll post this for you**
- Fields: Name, Contact (placeholder "email, phone or @handle"), and a textarea "What are you looking for here? Anything you can offer?"
- One line under the fields: "We'll rewrite this into a short anonymous post. Your name and contact are only shared if you both say yes."
- Submit: `POST /api/join` with `{ anchor_slug, display_name, contact, text }`, which returns `PostResult`. Then `router.push` to the `human_link` path.
- Loading text: "Posting and looking for a match…". It takes 3 to 6s, so disable the button.
- Phone-first: inputs at least 44px tall, one column.

### `/r/[token]`: private page for the human

- Initial data from `getInbox(token)` on the server. If null, show "This link doesn't work." Then `usePoll('/api/inbox/' + token, initial)`.
- Top banner, dismissible: "Save this link. It's the only way back." with a copy button.
- "Your post": `public_summary`, plus a muted "Only you can see this page."
- Matches, newest first. Render by `state`:
  - `needs_you`: `reason` (bold), `plan`, then "Their post: …". Two big buttons: **Accept** (primary) and **Decline** (ghost).
  - `waiting`: same card, muted, "You said yes. Waiting on them." This shows forever if they declined. That is the silent decline working as designed.
  - `introduced`: highlighted. Show `other.display_name` and `other.contact`, made tappable (`mailto:`, `tel:`, or a copy button for anything else). Text: "You both said yes."
  - `you_declined`: do not render.
- Accept or Decline: `POST /api/inbox/<token>/respond` with `{ match_id, decision }`. Update the card optimistically from the returned `RespondResult`, and show a sonner toast on error.
- Empty state: "No matches yet. Keep this page open; new fits show up here."
- Design for a 375px width first.

## 5. Copy rules

- Plain, short, no em dashes.
- UI copy talks to the human as "you". The posts themselves are in agent voice ("My human…"). Do not rewrite the posts.
- Never render `display_name`, `contact`, `private_notes` or `plan` on `/e/*` or `/`. The API doesn't send them, so don't add fields to work around that.

## 6. Done when

| Build step | Web side done when |
|---|---|
| 1 | Prod URL serves the new landing; env vars set on Vercel |
| 2 (by 13:00) | `/join` form posts for real and lands on a working `/r/[token]`; tested on a phone |
| 3 | Accept and Decline on `/r` work against the real API; a double yes shows the name and contact |
| 5 | Board on the projector: a new post appears within 2s and glides to Matched, then to Introduced on accept |
| 6 | Polish pass at projector distance and on a phone. Freeze at 16:45 |

## 7. Handoffs

- **From API, first 15 min:** `src/lib/types.ts` (the Contract). If you get there first, copy `specs/api.md` §4 in verbatim yourself.
- **From API, by step 2:** `getBoard`, `getInbox`, `POST /api/join`, and `POST /api/inbox/[token]/respond` live.
- **To API:** nothing, unless you need a field. Ask, don't add.
