import "server-only";
import { randomBytes } from "node:crypto";
import { embed } from "ai";
import type { z } from "zod";
import { embeddingModel } from "@/lib/ai";
import { ApiError } from "@/lib/http";
import type { createAnchorInput } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AnchorCreated, AnchorHit, AnchorSearch, AnchorSummary } from "@/lib/types";
import { looksLikeUrl, normaliseUrl, slugify, TEST_PREFIX } from "@/lib/url";

export const ANCHOR_COLUMNS = "id, slug, title, description, url, starts_at, place" as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONFIDENT = 0.55; // top search score that counts as a confident hit (tune on the day)

// pgvector reads the "[…]" text form, for inserts and rpc arguments alike.
export async function embedText(value: string): Promise<string | null> {
  try {
    const { embedding } = await embed({ model: embeddingModel, value, maxRetries: 1 });
    return JSON.stringify(embedding);
  } catch (e) {
    console.error("embed failed", e instanceof Error ? e.message : "unknown");
    return null;
  }
}

const db = () => createAdminClient();

async function one(column: "id" | "slug" | "url", value: string): Promise<AnchorSummary | null> {
  const { data, error } = await db().from("anchors").select(ANCHOR_COLUMNS).eq(column, value).maybeSingle<AnchorSummary>();
  if (error) throw new Error(`anchor lookup failed: ${error.code}`);
  return data;
}

// Accepts a URL (preferred), uuid, slug or exact title.
export async function getAnchor(ref: string): Promise<AnchorSummary | null> {
  const r = ref.trim();
  if (!r) return null;
  if (looksLikeUrl(r)) {
    const url = normaliseUrl(r);
    return url ? one("url", url) : null;
  }
  if (UUID.test(r)) return one("id", r.toLowerCase());
  const bySlug = await one("slug", r.toLowerCase());
  if (bySlug) return bySlug;
  const { data, error } = await db()
    .from("anchors")
    .select(ANCHOR_COLUMNS)
    .ilike("title", r.replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(1)
    .maybeSingle<AnchorSummary>();
  if (error) throw new Error(`anchor lookup failed: ${error.code}`);
  return data;
}

const hit = ({ description: _d, ...a }: AnchorSummary, score: number): AnchorHit => ({ ...a, score });

export async function findAnchors(query: string): Promise<AnchorSearch> {
  const q = query.trim();
  if (looksLikeUrl(q)) {
    const url = normaliseUrl(q);
    const a = url ? await one("url", url) : null;
    return a
      ? { confident: true, candidates: [hit(a, 1)], hint: "Exact match on the link. Use the link (or this id) as anchor_id." }
      : {
          confident: false,
          candidates: [],
          hint: "No board for this link yet. Create it with POST /api/anchors (or create_anchor), passing this url and the event's real title.",
        };
  }

  const emb = await embedText(q);
  if (!emb) throw new ApiError("search_unavailable", "Search is down for a moment. Pass the event's link instead, or retry.", 503);
  const { data, error } = await db().rpc("search_anchors", { query_embedding: emb, match_count: 5 });
  if (error) throw new Error(`search_anchors failed: ${error.code}`);
  const candidates = (data as (Omit<AnchorHit, "score"> & { score: number })[]).map((a) => ({
    ...a,
    score: Math.round(a.score * 100) / 100,
  }));
  return {
    confident: (candidates[0]?.score ?? 0) >= CONFIDENT,
    candidates,
    hint: candidates.length
      ? "If unsure, ask your human which one, or for the event's link. If none fit, create one."
      : "No boards match. Create one with POST /api/anchors (or create_anchor), with the event's link if it has one.",
  };
}

function parseDate(s: string | undefined): string | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

// Idempotent on the normalised URL.
export async function createAnchor(input: z.infer<typeof createAnchorInput>): Promise<AnchorCreated> {
  const url = input.url ? normaliseUrl(input.url) : null;
  if (input.url && !url) throw new ApiError("invalid", "url isn't a web address. Send the event's page, e.g. https://luma.com/…", 400);
  if (url) {
    const existing = await one("url", url);
    if (existing) return { ...existing, existing: true, note: "A board for this link already exists. Use this one." };
  }

  const starts_at = parseDate(input.starts_at);
  const embedding = await embedText([input.title, input.description, input.place, starts_at?.slice(0, 10)].filter(Boolean).join(" · "));
  // Test boards (smoke, e2e) never take a real board's slug.
  const base = (url?.startsWith(TEST_PREFIX) ? "test-" : "") + slugify(input.title);

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = attempt === 0 ? base : `${base.slice(0, 35)}-${randomBytes(2).toString("hex")}`;
    const { data, error } = await db()
      .from("anchors")
      .insert({ slug, title: input.title, description: input.description ?? null, url, starts_at, place: input.place ?? null, embedding })
      .select(ANCHOR_COLUMNS)
      .single<AnchorSummary>();
    if (!error) return { ...data, existing: false };
    if (error.code !== "23505") throw new Error(`anchor insert failed: ${error.code}`);
    // Unique violation: a concurrent create for the same URL wins, otherwise retry with a new slug.
    if (url) {
      const raced = await one("url", url);
      if (raced) return { ...raced, existing: true, note: "A board for this link already exists. Use this one." };
    }
  }
  throw new Error("anchor insert failed: slug collisions");
}
