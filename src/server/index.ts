import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Agent } from "../agent/index.ts";
import { createProvider } from "../providers/index.ts";
import type { ProviderName } from "../providers/index.ts";
import { createDefaultRegistry } from "../tools/index.ts";
import { MemoryStore } from "../memory/store.ts";
import { scanProject } from "../context/scanner.ts";
import { loadConfig } from "../agent/personality.ts";
import { createRoutes, type RouteContext } from "./routes.ts";

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

  const routes = createRoutes();
  const context: RouteContext = {
    agent,
    memory,
    config: appConfig,
  };

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const method = req.method ?? "GET";

    // Collect body for non-GET requests
    let body = "";
    if (method !== "GET" && method !== "HEAD") {
      body = await new Promise<string>((resolve) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks).toString()));
      });
    }

    // Create a Request object for route handlers
    const request = new Request(url.toString(), {
      method,
      headers: req.headers as Record<string, string>,
      body: body || undefined,
    });

    // Find matching route
    const route = matchRoute(routes, method, url.pathname);

    if (!route) {
      res.writeHead(404, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    try {
      const response = await route.handler(request, context);

      // Copy headers from Response to ServerResponse
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      res.writeHead(response.status, headers);

      if (response.body) {
        const reader = response.body.getReader();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        };
        await pump();
      } else {
        res.end();
      }
    } catch (error) {
      res.writeHead(500, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  });

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

function matchRoute(routes: ReturnType<typeof createRoutes>, method: string, pathname: string) {
  return routes.find((r) => {
    if (r.method !== method) return false;

    // Exact match
    if (r.path === pathname) return true;

    // Pattern match: /tasks/:id/done
    if (r.path.includes(":")) {
      const pattern = r.path.replace(/:[^/]+/g, "[^/]+");
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(pathname);
    }

    return false;
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
  }
}
