import { ApiReference } from "@scalar/nextjs-api-reference";

// Human-readable API docs, from /api/openapi.json.
export const GET = ApiReference({ url: "/api/openapi.json", pageTitle: "Awkward API" });
