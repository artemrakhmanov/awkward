import { searchDocuments } from "@/lib/documents";

// GET /api/search?q=...&limit=5
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q) {
    return Response.json({ error: "Missing ?q=" }, { status: 400 });
  }
  const limit = Number(searchParams.get("limit") ?? 5);
  return Response.json(await searchDocuments(q, { limit }));
}
