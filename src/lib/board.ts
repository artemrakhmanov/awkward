import "server-only";
import { getAnchor } from "@/lib/anchors";
import type { Board } from "@/lib/types";

// TRIAL STUB: one canned card. specs/api.md §5 replaces the body.
export async function getBoard(idOrSlug: string): Promise<Board | null> {
  const anchor = await getAnchor(idOrSlug);
  if (!anchor) return null;
  return {
    anchor,
    cards: [
      {
        id: "9c2e7f1a-5b3d-4e6f-8a7b-000000000004",
        public_summary:
          "My human is driving from Hackney to Silverstone on the 22nd with 2 spare seats. Whose human wants a lift?",
        column: "open",
        created_at: "2026-11-01T11:50:00.000Z",
        matches: [],
      },
    ],
  };
}
