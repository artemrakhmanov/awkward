import "server-only";
import { embed, embedMany } from "ai";
import { embeddingModel } from "@/lib/ai";
import { createAdminClient } from "@/lib/supabase/admin";

export type DocumentInput = {
  content: string;
  metadata?: Record<string, unknown>;
};

export type DocumentMatch = {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

export async function addDocuments(docs: DocumentInput[]) {
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: docs.map((d) => d.content),
  });

  const { data, error } = await createAdminClient()
    .from("documents")
    .insert(
      docs.map((d, i) => ({
        content: d.content,
        metadata: d.metadata ?? {},
        embedding: embeddings[i],
      })),
    )
    .select("id");

  if (error) throw error;
  return data.map((row) => row.id as number);
}

export async function searchDocuments(
  query: string,
  { limit = 5, threshold = 0.3 }: { limit?: number; threshold?: number } = {},
): Promise<DocumentMatch[]> {
  const { embedding } = await embed({ model: embeddingModel, value: query });

  const { data, error } = await createAdminClient().rpc("match_documents", {
    query_embedding: embedding,
    match_count: limit,
    match_threshold: threshold,
  });

  if (error) throw error;
  return data as DocumentMatch[];
}
