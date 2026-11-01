import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { chatModel } from "@/lib/ai";
import { searchDocuments } from "@/lib/documents";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: chatModel,
    instructions:
      "You are a helpful assistant. Use searchKnowledgeBase when the user asks about stored information.",
    messages: await convertToModelMessages(messages),
    tools: {
      searchKnowledgeBase: tool({
        description: "Semantic search over the documents knowledge base",
        inputSchema: z.object({ query: z.string() }),
        execute: ({ query }) => searchDocuments(query),
      }),
    },
    stopWhen: isStepCount(5),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
