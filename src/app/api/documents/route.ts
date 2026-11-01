import { z } from "zod";
import { addDocuments } from "@/lib/documents";

const bodySchema = z.object({
  documents: z
    .array(
      z.object({
        content: z.string().min(1),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1),
});

// Embeds and stores documents: POST { documents: [{ content, metadata? }] }
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 400 });
  }
  const ids = await addDocuments(parsed.data.documents);
  return Response.json({ ids }, { status: 201 });
}
