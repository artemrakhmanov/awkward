import "server-only";
import { cache } from "react";
import { getBoard } from "@/lib/board";
import { API_ORIGIN } from "@/lib/config";
import type { AnchorSummary, Board } from "@/lib/types";

// Local dev can't read the Supabase secrets, so when NEXT_PUBLIC_API_ORIGIN is set
// the board is read over HTTP from that origin instead.
export const loadBoard = cache(async (ref: string): Promise<Board | null> => {
  if (!API_ORIGIN) return getBoard(ref);
  const res = await fetch(`${API_ORIGIN}/api/board/${encodeURIComponent(ref)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Board request failed: ${res.status}`);
  return res.json();
});

// Where an agent reads the instructions for this board. The URL stays raw so it reads well.
export const agentsPath = (a: Pick<AnchorSummary, "url" | "slug">) =>
  a.url ? `/agents.md?url=${a.url}` : `/agents.md?a=${a.slug}`;

// Accepts a URL raw or encoded.
export const decodeRef = (ref: string) => {
  try {
    return ref.includes("%") ? decodeURIComponent(ref) : ref;
  } catch {
    return ref;
  }
};
