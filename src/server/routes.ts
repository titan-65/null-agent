import type { Agent } from "../agent/index.ts";
import type { MemoryStore } from "../memory/store.ts";
import type { NullAgentConfig } from "../agent/personality.ts";
import { formatTaskList } from "../agent/tasks.ts";
import { saveConfig } from "../agent/personality.ts";

export interface ServerOptions {
  port: number;
  host: string;
}

export interface RouteContext {
  agent: Agent;
  memory: MemoryStore;
  config: NullAgentConfig;
}

export type RouteHandler = (req: Request, ctx: RouteContext) => Promise<Response> | Response;

export interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
}

export function createRoutes(): Route[] {
  return [
    { method: "GET", path: "/health", handler: handleHealth },
    { method: "POST", path: "/chat", handler: handleChat },
    { method: "POST", path: "/chat/stream", handler: handleChatStream },
    { method: "GET", path: "/history", handler: handleGetHistory },
    { method: "DELETE", path: "/history", handler: handleClearHistory },
    { method: "GET", path: "/conversations", handler: handleListConversations },
    { method: "POST", path: "/conversations/resume", handler: handleResumeConversation },
    { method: "GET", path: "/tasks", handler: handleGetTasks },
    { method: "POST", path: "/tasks", handler: handleAddTask },
    { method: "POST", path: "/tasks/:id/done", handler: handleCompleteTask },
    { method: "GET", path: "/config", handler: handleGetConfig },
    { method: "PATCH", path: "/config", handler: handleUpdateConfig },
  ];
}

async function handleHealth(): Promise<Response> {
  return json({ status: "ok", version: "0.0.0" });
}

async function handleChat(req: Request, ctx: RouteContext): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const message = body.message;

  if (!message) {
    return json({ error: "message is required" }, 400);
  }

  const result = await ctx.agent.chat(message);

  return json({
    content: result.content,
    iterations: result.iterations,
    toolCalls: result.toolCalls,
  });
}

async function handleChatStream(req: Request, ctx: RouteContext): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const message = body.message;

  if (!message) {
    return json({ error: "message is required" }, 400);
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function handleGetHistory(_req: Request, ctx: RouteContext): Promise<Response> {
  const history = ctx.agent.getHistory();
  return json({ messages: history });
}

async function handleClearHistory(_req: Request, ctx: RouteContext): Promise<Response> {
  ctx.agent.clearHistory();
  return json({ status: "cleared" });
}

async function handleListConversations(_req: Request, ctx: RouteContext): Promise<Response> {
  const conversations = await ctx.memory.listConversations(20);
  return json({ conversations });
}

async function handleResumeConversation(req: Request, ctx: RouteContext): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const id = body.id;

  if (!id) {
    return json({ error: "id is required" }, 400);
  }

  const conversation = await ctx.agent.resumeConversation(id);
  if (!conversation) {
    return json({ error: "conversation not found" }, 404);
  }

  return json({
    id: conversation.id,
    title: conversation.title,
    messageCount: conversation.metadata.messageCount,
  });
}

async function handleGetTasks(_req: Request, ctx: RouteContext): Promise<Response> {
  const tasks = ctx.agent.getTasks();
  return json({ tasks, formatted: formatTaskList(tasks) });
}

async function handleAddTask(req: Request, ctx: RouteContext): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { description?: string };

  if (!body.description) {
    return json({ error: "description is required" }, 400);
  }

  const task = ctx.agent.addTask(body.description);
  return json({ task }, 201);
}

async function handleCompleteTask(req: Request, ctx: RouteContext): Promise<Response> {
  const url = new URL(req.url);
  const id = url.pathname.split("/")[2]; // /tasks/:id/done

  if (!id) {
    return json({ error: "task id is required" }, 400);
  }

  const task = ctx.agent.completeTask(id);
  if (!task) {
    return json({ error: "task not found" }, 404);
  }

  return json({ task });
}

async function handleGetConfig(_req: Request, ctx: RouteContext): Promise<Response> {
  return json(ctx.config);
}

async function handleUpdateConfig(req: Request, ctx: RouteContext): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    personality?: {
      tone?: string;
      verbosity?: string;
      proactivity?: string;
    };
  };

  if (body.personality) {
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

  return json(ctx.config);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
