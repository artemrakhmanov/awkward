import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { chatModel } from "@/lib/ai";

export const decisionInputSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  context: z.string().optional(),
});

export const decisionSchema = z.object({
  choice: z.string().describe("Exactly one of the provided options"),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  tradeoffs: z.array(z.string()),
});

export type DecisionInput = z.input<typeof decisionInputSchema>;
export type Decision = z.infer<typeof decisionSchema>;

export async function decide(input: DecisionInput): Promise<Decision> {
  const { question, options, context } = decisionInputSchema.parse(input);

  const { output } = await generateText({
    model: chatModel,
    instructions:
      "You are a decisive analyst. Pick exactly one of the given options, " +
      "copying it verbatim into `choice`. Ground your reasoning in the provided context.",
    output: Output.object({ schema: decisionSchema }),
    prompt: [
      `Question: ${question}`,
      `Options:\n${options.map((o) => `- ${o}`).join("\n")}`,
      context && `Context:\n${context}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  return output;
}
