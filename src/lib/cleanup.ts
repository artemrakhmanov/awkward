import "server-only";
import { ApiError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseUrl, TEST_PREFIX } from "@/lib/url";

// Test runs (smoke, e2e) post on boards under TEST_PREFIX and delete them afterwards.
// Nothing outside it can be deleted, so a real board is never at risk.

export type CleanupResult = { boards: number; requests: number; log_rows: number };

// Deletes one test board (by its URL) or every test board, with their requests, matches, reveals
// and the event-log rows of their tokens (req_ref is the first 8 hex of the token's sha256, as stored).
// By id: only a board with no URL or a test URL, created in the last 6 hours (a stray board an agent made during a run).
export async function cleanupTestBoards({ url, all, id }: { url?: string; all?: boolean; id?: string }): Promise<CleanupResult> {
  const db = createAdminClient();
  let q = db.from("anchors").select("id");
  if (all) q = q.like("url", `${TEST_PREFIX}%`);
  else if (id) {
    q = q
      .eq("id", id)
      .or(`url.is.null,url.like.${TEST_PREFIX}*`)
      .gt("created_at", new Date(Date.now() - 6 * 3600_000).toISOString());
  } else {
    const u = url ? normaliseUrl(url) : null;
    if (!u?.startsWith(TEST_PREFIX)) {
      throw new ApiError("not_test_board", `Only boards under ${TEST_PREFIX} can be cleaned up.`, 400);
    }
    q = q.eq("url", u);
  }
  const { data: anchors, error } = await q;
  if (error) throw error;
  const ids = anchors.map((a) => a.id as string);
  if (!ids.length) return { boards: 0, requests: 0, log_rows: 0 };

  const { data: reqs, error: rErr } = await db.from("requests").select("agent_token_hash, human_token_hash").in("anchor_id", ids);
  if (rErr) throw rErr;
  const refs = reqs.flatMap((r) => [r.agent_token_hash.slice(0, 8), r.human_token_hash.slice(0, 8)]);

  // Matches and reveals go with their requests (on delete cascade).
  const { error: dReq } = await db.from("requests").delete().in("anchor_id", ids);
  if (dReq) throw dReq;
  const { error: dAnc } = await db.from("anchors").delete().in("id", ids);
  if (dAnc) throw dAnc;

  let log_rows = 0;
  for (let i = 0; i < refs.length; i += 200) {
    const { count, error: dLog } = await db.from("trial_log").delete({ count: "exact" }).in("req_ref", refs.slice(i, i + 200));
    if (dLog) console.error("cleanup log delete failed", dLog.message);
    log_rows += count ?? 0;
  }
  return { boards: ids.length, requests: reqs.length, log_rows };
}
