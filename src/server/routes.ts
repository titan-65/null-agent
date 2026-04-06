import {
  createRouter,
  readBody,
  setResponseStatus,
  sendStream,
  getRouterParam,
  type H3Event,
} from "h3";
import type { Agent } from "../agent/index.ts";
import type { MemoryStore } from "../memory/store.ts";
import type { NullAgentConfig } from "../agent/personality.ts";
import { formatTaskList } from "../agent/tasks.ts";
import { saveConfig } from "../agent/personality.ts";
import { VERSION } from "../version.ts";

export interface RouteContext {
  agent: Agent;
  memory: MemoryStore;
  config: NullAgentConfig;
}

export function registerRoutes(app: any, ctx: RouteContext): void {
  const router = createRouter();

  // Health
  router.get("/health", () => ({
    status: "ok",
    version: VERSION,
  }));

  // Chat
  router.post("/chat", async (event: H3Event) => {
    const body = await readBody(event);
    const message = body?.message;

    if (!message) {
      setResponseStatus(event, 400);
      return { error: "message is required" };
    }

    const result = await ctx.agent.chat(message);

    return {
      content: result.content,
      iterations: result.iterations,
      toolCalls: result.toolCalls,
    };
  });

  // Chat stream (SSE)
  router.post("/chat/stream", async (event: H3Event) => {
    const body = await readBody(event);
    const message = body?.message;

    if (!message) {
      setResponseStatus(event, 400);
      return { error: "message is required" };
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const result = await ctx.agent.chat(message, {
            onText: (text) => {
              send({ type: "text", content: text });
            },
            onToolCall: (name, args) => {
              send({ type: "tool_call", name, arguments: args });
            },
            onToolResult: (name, result, isError) => {
              send({ type: "tool_result", name, result, isError });
            },
          });

          send({
            type: "done",
            content: result.content,
            iterations: result.iterations,
          });
        } catch (error) {
          send({
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }

        controller.close();
      },
    });

    event.node.res.setHeader("Content-Type", "text/event-stream");
    event.node.res.setHeader("Cache-Control", "no-cache");
    event.node.res.setHeader("Connection", "keep-alive");

    return sendStream(event, stream);
  });

  // History
  router.get("/history", () => {
    const history = ctx.agent.getHistory();
    return { messages: history };
  });

  router.delete("/history", () => {
    ctx.agent.clearHistory();
    return { status: "cleared" };
  });

  // Conversations
  router.get("/conversations", async () => {
    const conversations = await ctx.memory.listConversations(20);
    return { conversations };
  });

  router.get("/conversations/search", async (event: H3Event) => {
    const query = event.node.req.url?.split("?q=")[1]?.split("&")[0];

    if (!query) {
      setResponseStatus(event, 400);
      return { error: "q parameter is required" };
    }

    const results = await ctx.memory.searchConversations({
      query: decodeURIComponent(query),
      limit: 10,
    });

    return { results };
  });

  router.post("/conversations/resume", async (event: H3Event) => {
    const body = await readBody(event);
    const id = body?.id;

    if (!id) {
      setResponseStatus(event, 400);
      return { error: "id is required" };
    }

    const conversation = await ctx.agent.resumeConversation(id);
    if (!conversation) {
      setResponseStatus(event, 404);
      return { error: "conversation not found" };
    }

    return {
      id: conversation.id,
      title: conversation.title,
      messageCount: conversation.metadata.messageCount,
    };
  });

  // Tasks
  router.get("/tasks", () => {
    const tasks = ctx.agent.getTasks();
    return { tasks, formatted: formatTaskList(tasks) };
  });

  router.post("/tasks", async (event: H3Event) => {
    const body = await readBody(event);

    if (!body?.description) {
      setResponseStatus(event, 400);
      return { error: "description is required" };
    }

    const task = ctx.agent.addTask(body.description);
    setResponseStatus(event, 201);
    return { task };
  });

  router.post("/tasks/:id/done", (event: H3Event) => {
    const id = getRouterParam(event, "id");

    if (!id) {
      setResponseStatus(event, 400);
      return { error: "task id is required" };
    }

    const task = ctx.agent.completeTask(id);
    if (!task) {
      setResponseStatus(event, 404);
      return { error: "task not found" };
    }

    return { task };
  });

  // Config
  router.get("/config", () => ctx.config);

  router.patch("/config", async (event: H3Event) => {
    const body = await readBody(event);

    if (body?.personality) {
      const p = body.personality;
      if (p.tone && ["professional", "casual", "concise"].includes(p.tone)) {
        ctx.config.personality.tone = p.tone as "professional" | "casual" | "concise";
      }
      if (p.verbosity && ["minimal", "balanced", "detailed"].includes(p.verbosity)) {
        ctx.config.personality.verbosity = p.verbosity as "minimal" | "balanced" | "detailed";
      }
      if (p.proactivity && ["passive", "balanced", "active"].includes(p.proactivity)) {
        ctx.config.personality.proactivity = p.proactivity as "passive" | "balanced" | "active";
      }
      await saveConfig(ctx.config);
    }

    return ctx.config;
  });

  // Catch-all 404
  router.use(() => {
    return { error: "Not found" };
  });

  app.use(router);
}
