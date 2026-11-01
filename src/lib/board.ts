import "server-only";
import { getAnchor } from "@/lib/anchors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Board, BoardCard, Column } from "@/lib/types";

type Status = "pending" | "accepted" | "declined";

// Public. Only public_summary, the column and {status, reason} per live match ever leave here.
export async function getBoard(ref: string): Promise<Board | null> {
  const anchor = await getAnchor(ref);
  if (!anchor) return null;
  const db = createAdminClient();
  const now = new Date().toISOString();

  const [{ data: requests, error: rErr }, { data: matches, error: mErr }] = await Promise.all([
    db
      .from("requests")
      .select("id, public_summary, status, created_at, expires_at")
      .eq("anchor_id", anchor.id)
      .neq("status", "closed")
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .returns<{ id: string; public_summary: string; status: string; created_at: string; expires_at: string }[]>(),
    db
      .from("matches")
      .select("req_a, req_b, reason, a_status, b_status")
      .eq("anchor_id", anchor.id)
      .returns<{ req_a: string; req_b: string; reason: string; a_status: Status; b_status: Status }[]>(),
  ]);
  if (rErr) throw new Error(`board requests failed: ${rErr.code}`);
  if (mErr) throw new Error(`board matches failed: ${mErr.code}`);

  // Live: both requests still on the board (so not expired or closed) and nobody declined.
  const visible = new Set(requests.map((r) => r.id));
  const live = matches.filter(
    (m) => visible.has(m.req_a) && visible.has(m.req_b) && m.a_status !== "declined" && m.b_status !== "declined",
  );

  const cards = requests.map((r): BoardCard => {
    const mine = live
      .filter((m) => m.req_a === r.id || m.req_b === r.id)
      .map((m) => ({
        status: m.a_status === "accepted" && m.b_status === "accepted" ? ("introduced" as const) : ("pending" as const),
        reason: m.reason,
      }));
    const column: Column = mine.some((m) => m.status === "introduced") ? "introduced" : mine.length ? "matched" : "open";
    return { id: r.id, public_summary: r.public_summary, column, created_at: r.created_at, matches: mine };
  });
  return { anchor, cards };
}
