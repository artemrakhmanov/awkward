import "server-only";

// Plain "provider/model" strings route through the Vercel AI Gateway (AI_GATEWAY_API_KEY).
export const chatModel = process.env.CHAT_MODEL ?? "anthropic/claude-sonnet-5";
export const embeddingModel =
  process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small";
