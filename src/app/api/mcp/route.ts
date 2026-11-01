import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { decide, decisionInputSchema } from "@/lib/decide";
import { addDocuments, searchDocuments } from "@/lib/documents";

// MCP server at /api/mcp — exposes the same logic as the REST routes.
const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_documents",
      {
        title: "Search documents",
        description: "Semantic vector search over the knowledge base.",
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().int().min(1).max(20).default(5),
        }),
      },
      async ({ query, limit }) => {
        const matches = await searchDocuments(query, { limit });
        return { content: [{ type: "text", text: JSON.stringify(matches, null, 2) }] };
      },
    );

    server.registerTool(
      "add_document",
      {
        title: "Add document",
        description: "Embed a piece of text and store it in the knowledge base.",
        inputSchema: z.object({
          content: z.string().min(1),
          metadata: z.record(z.string(), z.unknown()).optional(),
        }),
      },
      async (doc) => {
        const [id] = await addDocuments([doc]);
        return { content: [{ type: "text", text: `Stored document ${id}` }] };
      },
    );

    server.registerTool(
      "decide",
      {
        title: "Make a decision",
        description:
          "Pick one option for a question, with confidence, reasoning and trade-offs.",
        inputSchema: decisionInputSchema,
      },
      async (input) => {
        const decision = await decide(input);
        return { content: [{ type: "text", text: JSON.stringify(decision, null, 2) }] };
      },
    );
  },
  { serverInfo: { name: "awkward", version: "0.1.0" } },
);

export { handler as GET, handler as POST };
