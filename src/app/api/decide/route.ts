import { decide, decisionInputSchema } from "@/lib/decide";

export const maxDuration = 60;

export async function POST(req: Request) {
  const parsed = decisionInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 400 });
  }
  return Response.json(await decide(parsed.data));
}
