import { createServer } from "node:http";
import { createApp, toNodeListener } from "h3";
import { Agent } from "../agent/index.ts";
import { createProvider } from "../providers/index.ts";
import type { ProviderName } from "../providers/index.ts";
import { createDefaultRegistry } from "../tools/index.ts";
import { MemoryStore } from "../memory/store.ts";
import { scanProject } from "../context/scanner.ts";
import { loadConfig } from "../agent/personality.ts";
import { registerRoutes } from "./routes.ts";

export interface ServerConfig {
  port: number;
  host: string;
  provider?: ProviderName;
  model?: string;
}

export async function startServer(config: ServerConfig): Promise<void> {
  const appConfig = await loadConfig();
  const providerName = config.provider ?? appConfig.defaultProvider ?? getProviderFromEnv();
  const provider = createProvider(providerName);
  const model = config.model ?? appConfig.defaultModel ?? getDefaultModel(providerName);
  const tools = createDefaultRegistry();
  const memory = new MemoryStore();

  let projectKnowledge;
  try {
    projectKnowledge = await scanProject(process.cwd());
  } catch {
    // skip
  }

  const agent = new Agent({
    provider,
    tools,
    model,
    memory,
    projectKnowledge,
    personality: appConfig.personality,
  });

  await agent.loadConversation(process.cwd());
  await agent.startConversation(
    process.cwd(),
    projectKnowledge?.projectName ?? "unknown",
    providerName,
    model,
  );

  const app = createApp();

  // Register routes
  registerRoutes(app, { agent, memory, config: appConfig });

  // Create and start server
  const server = createServer(toNodeListener(app));

  server.listen(config.port, config.host, () => {
    console.log(`\n  null-agent API server running at http://${config.host}:${config.port}\n`);
    console.log("  Endpoints:");
    console.log("    POST /chat          — send a message");
    console.log("    POST /chat/stream   — send a message (SSE streaming)");
    console.log("    GET  /history       — get conversation history");
    console.log("    DELETE /history     — clear conversation history");
    console.log("    GET  /conversations — list past conversations");
    console.log("    POST /conversations/resume — resume a conversation");
    console.log("    GET  /tasks         — get tracked tasks");
    console.log("    POST /tasks         — add a task");
    console.log("    POST /tasks/:id/done — complete a task");
    console.log("    GET  /config        — get configuration");
    console.log("    PATCH /config       — update configuration");
    console.log("    GET  /health        — health check");
    console.log("");
  });
}

function getProviderFromEnv(): ProviderName {
  if (process.env["ANTHROPIC_API_KEY"]) return "anthropic";
  if (process.env["OPENAI_API_KEY"]) return "openai";
  return "anthropic";
}

function getDefaultModel(provider: ProviderName): string {
  switch (provider) {
    case "openai":
      return "gpt-4o";
    case "anthropic":
      return "claude-sonnet-4-20250514";
    case "gemini":
      return "gemini-2.0-flash";
    case "openrouter":
      return "google/gemini-2.0-flash-001";
    default:
      return "gpt-4o";
  }
}
