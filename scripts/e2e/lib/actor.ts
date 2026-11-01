// One cloud agent on the OpenAI Agents API. It knows nothing about Awkward: it gets a plain
// assistant prompt and a forced door, and learns the rest from /agents.md like a real agent.
//   http: hosted sandbox, network restricted to the prod host (it reads the doc and uses curl)
//   mcp:  our /api/mcp as its only tool, sandbox network off
import OpenAI from "openai";
import { BASE, MODEL, HOST, since } from "./env";

export type Door = "http" | "mcp";
export type ToolCall = {
  kind: "command" | "mcp" | "web_search" | "browser" | "other";
  name: string;
  input: unknown;
  output: unknown;
  status?: string | null;
  error?: unknown;
  ms?: number | null;
};
export type Turn = {
  actor: string;
  step: string;
  t: number; // seconds since run start, when the prompt was sent
  ms: number;
  prompt: string;
  reply: string;
  calls: ToolCall[];
  attempts: number;
  error?: string;
};

const INSTRUCTIONS =
  "You are a personal assistant for one human. Do what they ask using the tools you have. Reply to them in plain language.";
const TURN_TIMEOUT_MS = 240_000;

const client = new OpenAI();

export class Actor {
  sessionId: string | null = null;
  turns: Turn[] = [];

  constructor(
    public id: string,
    public role: string,
    public door: Door,
    private t0: number,
    private tags: Record<string, string> = {},
  ) {}

  get client() {
    return this.door === "http" ? "openai-agents/sandbox+curl" : "openai-agents/mcp";
  }

  async start() {
    const session = await client.beta.agents.sessions.create(
      this.door === "http"
        ? {
            environment: { type: "openai_hosted", network: { access: "restricted", allowed_domains: [HOST] } },
            agent: { model: MODEL, instructions: INSTRUCTIONS },
            metadata: { purpose: "awkward-e2e", actor: `${this.id} (${this.role}, ${this.door})`, ...this.tags },
          }
        : {
            environment: { type: "openai_hosted", network: { access: "disabled" } },
            agent: {
              model: MODEL,
              instructions: INSTRUCTIONS,
              tools: [
                {
                  type: "mcp",
                  server_label: "awkward",
                  transport: { type: "http", server_url: `${BASE}/api/mcp` },
                  connection_origin: "service",
                },
              ],
            },
            metadata: { purpose: "awkward-e2e", actor: `${this.id} (${this.role}, ${this.door})`, ...this.tags },
          },
    );
    this.sessionId = session.id;
  }

  // Sends one user message and waits for the turn to finish. One retry on failure or timeout.
  async say(step: string, prompt: string): Promise<Turn> {
    const t = since(this.t0);
    const started = Date.now();
    let last: Turn | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const res = await this.once(prompt);
      last = { actor: this.id, step, t, ms: Date.now() - started, prompt, attempts: attempt, ...res };
      if (!res.error) break;
    }
    this.turns.push(last!);
    return last!;
  }

  private async once(prompt: string): Promise<Pick<Turn, "reply" | "calls" | "error">> {
    if (!this.sessionId) await this.start();
    const stream = client.beta.agents.sessions.stream(this.sessionId!, { input: prompt });
    const timer = setTimeout(() => stream.abort(new Error("turn timeout")), TURN_TIMEOUT_MS);
    const calls: ToolCall[] = [];
    const finals: string[] = [];
    const commentary: string[] = [];
    let error: string | undefined;
    try {
      for await (const ev of stream) {
        if (ev.type === "agent.session.turn.item.done") {
          const item = ev.item as unknown as Record<string, unknown>;
          if (item.type === "message" && item.role === "assistant") {
            const text = ((item.content as { type: string; text?: string }[]) ?? [])
              .map((c) => c.text ?? "")
              .join("");
            (item.phase === "final_answer" ? finals : commentary).push(text);
          } else {
            const call = toCall(item);
            if (call) calls.push(call);
          }
        } else if (ev.type === "agent.session.turn.failed" || ev.type === "agent.session.failed") {
          error = JSON.stringify(ev).slice(0, 500);
        } else if (ev.type === "agent.session.requires_action") {
          error = `requires_action: ${JSON.stringify(ev.session.required_actions).slice(0, 300)}`;
          break;
        }
      }
    } catch (e) {
      error = e instanceof Error ? `${e.message}${e.cause instanceof Error ? `: ${e.cause.message}` : ""}` : String(e);
    } finally {
      clearTimeout(timer);
    }
    const reply = (finals.length ? finals : commentary).join("\n\n").trim();
    if (!error && !reply) error = "empty reply";
    return { reply, calls, error };
  }

  // Sessions are kept (not deleted) so their traces stay in the platform console for debugging.
  // Each one is tagged with metadata: purpose=awkward-e2e, run_id, scenario, actor.
  async stop() {}
}

function toCall(item: Record<string, unknown>): ToolCall | null {
  switch (item.type) {
    case "command_execution":
      return {
        kind: "command",
        name: "shell",
        input: item.command,
        output: item.output,
        status: item.status as string,
        error: item.exit_code ? `exit ${item.exit_code}` : undefined,
        ms: item.duration_ms as number | null,
      };
    case "mcp_call":
      return {
        kind: "mcp",
        name: String(item.name),
        input: item.arguments,
        output: item.output,
        status: item.status as string,
        error: item.error ?? undefined,
      };
    case "web_search_call":
      return { kind: "web_search", name: "web_search", input: item.action ?? item, output: null, status: item.status as string };
    case "computer_use_call":
      return { kind: "browser", name: "computer_use", input: item.action ?? null, output: null, status: item.status as string };
    case "reasoning":
      return null;
    default:
      return { kind: "other", name: String(item.type), input: item, output: null };
  }
}
