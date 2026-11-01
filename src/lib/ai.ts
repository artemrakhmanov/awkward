import "server-only";
import { openai } from "@ai-sdk/openai";

// OpenAI directly (OPENAI_API_KEY), not the Vercel AI Gateway. Env values may keep an "openai/" prefix.
const id = (v: string | undefined, fallback: string) => (v ?? fallback).replace(/^openai\//, "");

export const chatModel = openai(id(process.env.CHAT_MODEL, "gpt-6-astra"));
// Fast, cheap model for the matcher.
export const matchModel = openai(id(process.env.MATCH_MODEL ?? process.env.CHAT_MODEL, "gpt-5.4-mini"));
// Must output 1536 dimensions to match the migrations.
export const embeddingModel = openai.embedding(id(process.env.EMBEDDING_MODEL, "text-embedding-3-small"));
