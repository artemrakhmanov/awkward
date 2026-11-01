import { connection } from "next/server";
import { agentDocResponse } from "@/lib/agent-doc";

export async function GET(req: Request) {
  await connection();
  return agentDocResponse(req, "/agents.md");
}
