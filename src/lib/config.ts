export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
export const BASE_HOST = new URL(BASE_URL).host;
export const DEFAULT_ANCHOR_SLUG = "devday-hack-ldn";
export const MCP_URL = `${BASE_URL}/api/mcp`;
// Where client components call the API. Empty means same origin. In local dev without
// database keys, set NEXT_PUBLIC_API_ORIGIN=https://awkwardboard.com (the API allows CORS).
export const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "";
