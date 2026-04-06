import type { ChatOptions, Message, Provider, StreamChunk } from "../src/providers/types.ts";

class MockProvider implements Provider {
  async *chat(_messages: Message[], _options?: ChatOptions): AsyncIterable<StreamChunk> {
    yield { type: "text", text: "Mock response" };
    yield { type: "done" };
  }

  async chatComplete(_messages: Message[], _options?: ChatOptions): Promise<string> {
    return "Mock response";
  }
}

import { expect, test, describe, beforeEach, afterEach } from "vite-plus/test";
import { createApp, toNodeListener, eventHandler, readBody } from "h3";
import { createServer } from "node:http";
import { Agent } from "../src/agent/index.ts";
import { ToolRegistry } from "../src/tools/registry.ts";
import { MemoryStore } from "../src/memory/store.ts";
import type { NullAgentConfig } from "../src/agent/personality.ts";
import { VERSION } from "../src/version.ts";

function createTestApp(ctx: { agent: Agent; memory: MemoryStore; config: NullAgentConfig }) {
  const app = createApp();

  app.use(
    eventHandler(async (event) => {
      if (event.path === "/health") {
        return { status: "ok", version: VERSION };
      }

      if (event.path === "/chat" && event.method === "POST") {
        const body = await readBody(event);
        const message = body?.message;
        if (!message) {
          event.node.res.statusCode = 400;
          return { error: "message is required" };
        }
        const result = await ctx.agent.chat(message);
        return {
          content: result.content,
          iterations: result.iterations,
          toolCalls: result.toolCalls,
        };
      }

      if (event.path === "/history" && event.method === "GET") {
        const history = ctx.agent.getHistory();
        return { messages: history };
      }

      if (event.path === "/history" && event.method === "DELETE") {
        ctx.agent.clearHistory();
        return { status: "cleared" };
      }

      if (event.path === "/config" && event.method === "GET") {
        return ctx.config;
      }

      if (event.path === "/config" && event.method === "PATCH") {
        const body = await readBody(event);
        if (body?.personality) {
          const p = body.personality;
          if (p.tone && ["professional", "casual", "concise"].includes(p.tone)) {
            ctx.config.personality.tone = p.tone as any;
          }
        }
        return ctx.config;
      }

      if (event.path === "/tasks" && event.method === "GET") {
        const tasks = ctx.agent.getTasks();
        return { tasks };
      }

      if (event.path === "/tasks" && event.method === "POST") {
        const body = await readBody(event);
        if (!body?.description) {
          event.node.res.statusCode = 400;
          return { error: "description is required" };
        }
        const task = ctx.agent.addTask(body.description);
        return { task };
      }

      if (event.path === "/conversations" && event.method === "GET") {
        const conversations = await ctx.memory.listConversations(20);
        return { conversations };
      }

      if (event.path === "/conversations/search" && event.method === "GET") {
        const query = event.node.req.url?.split("?q=")[1]?.split("&")[0];
        if (!query) {
          event.node.res.statusCode = 400;
          return { error: "q parameter is required" };
        }
        const results = await ctx.memory.searchConversations({ query, limit: 10 });
        return { results };
      }

      event.node.res.statusCode = 404;
      return { error: "Not found" };
    }),
  );

  return app;
}

describe("Server routes integration", () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  beforeEach(async () => {
    const provider = new MockProvider();
    const tools = new ToolRegistry();
    const agent = new Agent({ provider, tools });
    const memory = new MemoryStore();
    const config: NullAgentConfig = {
      personality: { tone: "casual", verbosity: "balanced", proactivity: "balanced" },
      permissions: {
        mode: "auto",
        allowWrite: true,
        allowShell: true,
        allowGit: true,
        denyPatterns: [],
      },
      provider: { default: "anthropic" },
      plugins: [],
    };

    const app = createTestApp({ agent, memory, config });

    server = createServer(toNodeListener(app));

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const address = server.address();
    baseUrl = `http://localhost:${address?.port}`;
  });

  afterEach(() => {
    if (server) server.close();
  });

  test("GET /health returns ok", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.ok).toBe(true);

    const body = (await res.json()) as { status: string; version: string };
    expect(body.status).toBe("ok");
    expect(body.version).toBeDefined();
  });

  test("POST /chat requires message", async () => {
    const res = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("message");
  });

  test("POST /chat returns response", async () => {
    const res = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    });

    expect(res.ok).toBe(true);
    const body = (await res.json()) as { content: string; iterations: number };
    expect(body.content).toBeDefined();
  });

  test("GET /history returns messages", async () => {
    const res = await fetch(`${baseUrl}/history`);
    expect(res.ok).toBe(true);

    const body = (await res.json()) as { messages: unknown[] };
    expect(Array.isArray(body.messages)).toBe(true);
  });

  test("DELETE /history clears messages", async () => {
    const res = await fetch(`${baseUrl}/history`, { method: "DELETE" });
    expect(res.ok).toBe(true);

    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("cleared");
  });

  test("GET /config returns configuration", async () => {
    const res = await fetch(`${baseUrl}/config`);
    expect(res.ok).toBe(true);

    const body = (await res.json()) as { personality: unknown };
    expect(body.personality).toBeDefined();
  });

  test("PATCH /config updates configuration", async () => {
    const res = await fetch(`${baseUrl}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personality: { tone: "professional" } }),
    });

    expect(res.ok).toBe(true);
    const body = (await res.json()) as { personality: { tone: string } };
    expect(body.personality.tone).toBe("professional");
  });

  test("GET /tasks returns empty list initially", async () => {
    const res = await fetch(`${baseUrl}/tasks`);
    expect(res.ok).toBe(true);

    const body = (await res.json()) as { tasks: unknown[] };
    expect(Array.isArray(body.tasks)).toBe(true);
  });

  test("POST /tasks creates task", async () => {
    const res = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Test task" }),
    });

    expect(res.ok).toBe(true);
    const body = (await res.json()) as { task: { id: string } };
    expect(body.task.id).toBeDefined();
  });

  test("POST /tasks requires description", async () => {
    const res = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("description");
  });

  test("GET /conversations returns list", async () => {
    const res = await fetch(`${baseUrl}/conversations`);
    expect(res.ok).toBe(true);

    const body = (await res.json()) as { conversations: unknown[] };
    expect(Array.isArray(body.conversations)).toBe(true);
  });

  test("GET /conversations/search requires query", async () => {
    const res = await fetch(`${baseUrl}/conversations/search`);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("q parameter");
  });

  test("returns 404 for unknown route", async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Not found");
  });
});
