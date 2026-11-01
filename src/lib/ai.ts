import "server-only";
import { openai } from "@ai-sdk/openai";

// OpenAI directly (OPENAI_API_KEY), not the Vercel AI Gateway. Env values may keep an "openai/" prefix.
const id = (v: string | undefined, fallback: string) => (v ?? fallback).replace(/^openai\//, "");

// Short structured text: the matcher and the /join rewrite.
export const textModel = openai(id(process.env.TEXT_MODEL, "gpt-5.4-mini"));
// Decisions API (yes/no and choice questions): the privacy guard and decide().
export const decisionModel = openai.decisionModel(id(process.env.DECISION_MODEL, "gpt-6-luna"));
// Must output 1536 dimensions to match the migrations.
export const embeddingModel = openai.embedding(id(process.env.EMBEDDING_MODEL, "text-embedding-3-small"));
