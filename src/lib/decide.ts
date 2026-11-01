import "server-only";
import { experimental_decide } from "ai";
import { z } from "zod";
import { decisionModel } from "@/lib/ai";

// Pick one of `options` for `question`, judged against `context`. Used by the e2e judges (specs/e2e.md §5).
export const decisionInputSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  context: z.string().optional(),
});

export type DecisionInput = z.input<typeof decisionInputSchema>;
export type Decision = { choice: string; confidence: number; probabilities: Record<string, number> };

export async function decide(input: DecisionInput, { timeoutMs = 10_000 } = {}): Promise<Decision> {
  const { question, options, context } = decisionInputSchema.parse(input);
  const { answers } = await experimental_decide({
    model: decisionModel,
    state: context ?? question,
    questions: {
      answer: { type: "choice", instructions: question, criteria: Object.fromEntries(options.map((o) => [o, o])) },
    },
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(timeoutMs),
  });
  const { choice, probabilities = {} } = answers.answer;
  return { choice, confidence: probabilities[choice] ?? 1, probabilities };
}
