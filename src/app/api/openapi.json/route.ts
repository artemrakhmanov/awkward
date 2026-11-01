import { json, preflight } from "@/lib/http";
import { buildOpenApi } from "@/lib/openapi";

export const OPTIONS = preflight;

export function GET() {
  return json(buildOpenApi());
}
