export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
export const BASE_HOST = new URL(BASE_URL).host;
export const DEFAULT_ANCHOR_SLUG = "devday-hack-ldn";
export const MCP_URL = `${BASE_URL}/api/mcp`;
