import "server-only";
import type { AnchorCreated, AnchorSearch, AnchorSummary } from "@/lib/types";

// TRIAL STUB (specs/trial.md): one hardcoded board. specs/api.md §5 replaces the bodies.

export const TRIAL_ANCHOR: AnchorSummary = {
  id: "5e6c1a8e-7d2b-4c1f-9a3e-000000000001",
  slug: "silverstone-half",
  title: "Silverstone Half Marathon",
  description: "Half marathon at Silverstone circuit.",
  url: null,
  starts_at: "2026-11-22",
  place: "Silverstone, Northamptonshire",
};

export async function findAnchors(_query: string): Promise<AnchorSearch> {
  const { description: _d, ...hit } = TRIAL_ANCHOR;
  return {
    confident: true,
    candidates: [{ ...hit, score: 0.82 }],
    hint: "If unsure, ask your human. If none fit, create one.",
  };
}

export async function createAnchor(_input: { title: string }): Promise<AnchorCreated> {
  return { ...TRIAL_ANCHOR, existing: true, note: "A board for this already exists. Use this one." };
}

export async function getAnchor(ref: string): Promise<AnchorSummary | null> {
  const r = ref.trim().toLowerCase();
  const a = TRIAL_ANCHOR;
  return r === a.id || r === a.slug || r === a.title.toLowerCase() ? a : null;
}
