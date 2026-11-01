# Changes and requests between sessions

Append only, newest at the bottom. One line each: `HH:MM [backend|frontend] what changed or what you need`.
Check this file before starting each new piece of work.

- 11:00 [plan] Specs written: api.md, web.md, demo.md. Contract is api.md §4.
- 11:15 [plan] Agents arrive without a connector: the `/agents.md` front door, HTTP and MCP as equal doors, the `/join?text=` fallback. The Contract gained `AnchorSearch`, `AnchorCreated`, `PostResult.tell_your_human` and `next_steps`, and `AgentInbox.note`.
- 11:30 [plan] Backend starts with `specs/trial.md` (stub build plus real-agent test) before `specs/api.md`. The privacy guard is regex plus `decide()`, so `decide.ts` is kept. The similarity dedupe on `createAnchor` is deferred unless the trial shows a need.
- 11:45 [plan] A board's identity is its URL; slugs are aliases. `?url=` works on /agents.md, /e, /join and /api/board, raw or encoded. An unknown URL gives a "no board yet" state and the agent creates the board. `normaliseUrl` gets `HOST_ALIASES` (lu.ma → luma.com). TODO: the Silverstone race URL.
- 12:39 [backend] `src/lib/types.ts` is in (the Contract, api.md §4, unchanged). Import from `@/lib/types`.
- 12:39 [backend] Trial build (specs/trial.md) on prod. Stubs only: one board (`silverstone-half`), a canned inbox match, nothing stored. `human_link` points at `/api/trial/hello?t=` for now, not `/r/`.
- 12:39 [backend] Deleted template leftovers `src/app/api/{chat,decide,documents,search}` and `src/lib/documents.ts`. `decide.ts` no longer takes `useKnowledgeBase`.
- 12:39 [backend] Trial guard is regex only (no AI spend). The `decide()` layer is behind `GUARD_DECIDE=on`, off on prod.
- 12:39 [backend] Need from frontend: `/join?a=&text=` is linked from /agents.md and 404s until it exists.
- 12:44 [backend] AI goes to OpenAI directly, not the AI Gateway. `src/lib/ai.ts` uses `@ai-sdk/openai` (new dependency, 4.0.106). Env: `OPENAI_API_KEY`, `CHAT_MODEL` (default gpt-6-astra), `MATCH_MODEL` (default gpt-5.4-mini), `EMBEDDING_MODEL` (text-embedding-3-small). `chatModel`, `matchModel` and `embeddingModel` are now model objects, not strings. CLAUDE.md and api.md §0/§1 still say Gateway.
