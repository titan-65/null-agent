import type { Message } from "../providers/types.ts";
import type { AgentConfig, AgentResult, AgentCallbacks } from "./types.ts";
import { buildMessages, buildSystemPrompt } from "./context.ts";
import { ContextManager, truncateToolResult } from "../context/window.ts";
import { AgentEventEmitter, createAgentEvent } from "./events.ts";

const contextManager = new ContextManager();

export interface ToolHookContext {
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolHookConfig {
  beforeToolCall?: (context: ToolHookContext) => Promise<boolean | void>;
  afterToolCall?: (
    context: ToolHookContext & { result: { content: string; isError?: boolean } },
  ) => Promise<void>;
}

export async function runAgent(
  config: AgentConfig,
  userMessage: string,
  history: Message[],
  callbacks?: AgentCallbacks,
  toolHooks?: ToolHookConfig,
  eventEmitter?: AgentEventEmitter,
): Promise<AgentResult> {
  const maxIterations = config.maxIterations ?? 10;
  const systemPrompt = buildSystemPrompt({
    custom: config.systemPrompt,
    projectKnowledge: config.projectKnowledge,
    personality: config.personality,
  });

  const toolCalls: AgentResult["toolCalls"] = [];
  let iterations = 0;
  let fullResponse = "";

  const currentHistory: Message[] = [...history, { role: "user", content: userMessage }];

  await eventEmitter?.emit(createAgentEvent("agent_start", { message: userMessage }));

  while (iterations < maxIterations) {
    iterations++;

    await eventEmitter?.emit(createAgentEvent("turn_start", { turn: iterations }));

    let messages = buildMessages(systemPrompt, currentHistory);

    if (config.model) {
      messages = contextManager.prepareMessages(messages, config.model);
    }

    const providerTools = config.tools.toProviderTools();

    let assistantText = "";
    const pendingToolCalls: Array<{
      id: string;
      name: string;
      arguments: string;
    }> = [];

    await eventEmitter?.emit(createAgentEvent("message_start", { role: "assistant" }));

    for await (const chunk of config.provider.chat(messages, {
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      tools: providerTools,
      tool_choice: "auto",
    })) {
      if (chunk.type === "text" && chunk.text) {
        assistantText += chunk.text;
        callbacks?.onText?.(chunk.text);
        await eventEmitter?.emit(
          createAgentEvent("message_update", { content: assistantText, delta: chunk.text }),
        );
      }

      if (chunk.type === "tool_call" && chunk.toolCall) {
        pendingToolCalls.push(chunk.toolCall);
      }
    }

    await eventEmitter?.emit(createAgentEvent("message_end", { content: assistantText }));

    if (pendingToolCalls.length === 0) {
      fullResponse = assistantText;
      currentHistory.push({ role: "assistant", content: assistantText });
      break;
    }

    const aggregatedCalls = aggregateToolCalls(pendingToolCalls);

    const results = await executeToolCalls(
      aggregatedCalls,
      config,
      callbacks,
      toolCalls,
      toolHooks,
      eventEmitter,
    );

    const toolCallDescriptions = aggregatedCalls
      .map((tc) => `Called ${tc.name}(${formatArgsForHistory(tc.arguments)})`)
      .join("\n");

    const assistantMessage = assistantText
      ? `${assistantText}\n${toolCallDescriptions}`
      : toolCallDescriptions;

    currentHistory.push({ role: "assistant", content: assistantMessage });

    for (const { name, result } of results) {
      const formattedResult = formatToolResult(name, result.content);
      currentHistory.push({
        role: "user",
        content: `[Tool: ${name}]\n${formattedResult}`,
      });
    }

    if (iterations >= maxIterations) {
      fullResponse = assistantText || "Max iterations reached.";
    }
  }

  await eventEmitter?.emit(
    createAgentEvent("agent_end", {
      content: fullResponse,
      iterations,
      toolCalls,
    }),
  );

  return {
    content: fullResponse,
    iterations,
    toolCalls,
    history: currentHistory,
  };
}

function aggregateToolCalls(
  pending: Array<{ id: string; name: string; arguments: string }>,
): Array<{ name: string; arguments: string }> {
  const map = new Map<string, { name: string; arguments: string }>();

  for (const tc of pending) {
    const existing = map.get(tc.id);
    if (existing) {
      if (tc.name && !existing.name) existing.name = tc.name;
      if (tc.arguments) existing.arguments += tc.arguments;
    } else {
      map.set(tc.id, { name: tc.name, arguments: tc.arguments });
    }
  }

  return Array.from(map.values());
}

async function executeToolCalls(
  calls: Array<{ name: string; arguments: string }>,
  config: AgentConfig,
  callbacks: AgentCallbacks | undefined,
  toolCalls: AgentResult["toolCalls"],
  toolHooks: ToolHookConfig | undefined,
  eventEmitter: AgentEventEmitter | undefined,
): Promise<Array<{ name: string; result: { content: string; isError?: boolean } }>> {
  const parsed = calls.map((tc) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.arguments) as Record<string, unknown>;
    } catch {}
    return { name: tc.name, args };
  });

  if (config.permissions) {
    const denied: string[] = [];
    for (const { name, args } of parsed) {
      const check = await config.permissions.check(name, args);
      if (!check.allowed) {
        denied.push(name);
        callbacks?.onToolResult?.(name, `Permission denied for ${name}`, true);
      }
    }
    if (denied.length > 0) {
      return parsed
        .filter((p) => !denied.includes(p.name))
        .map((p) => ({
          name: p.name,
          result: { content: `Skipped: permission denied`, isError: false },
        }));
    }
  }

  const results: Array<{ name: string; result: { content: string; isError?: boolean } }> = [];

  for (const { name, args } of parsed) {
    const toolCallId = `tool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    callbacks?.onToolCall?.(name, args);
    toolCalls.push({ name, arguments: args });

    await eventEmitter?.emit(
      createAgentEvent("tool_execution_start", {
        toolCallId,
        name,
        arguments: args,
      }),
    );

    const beforeResult = await toolHooks?.beforeToolCall?.({
      toolCallId,
      name,
      arguments: args,
    });

    if (beforeResult === false) {
      const blockedResult = {
        content: "Tool execution blocked by beforeToolCall hook",
        isError: true,
      };
      await eventEmitter?.emit(
        createAgentEvent("tool_execution_end", {
          toolCallId,
          name,
          result: blockedResult.content,
          isError: true,
        }),
      );
      await toolHooks?.afterToolCall?.({
        toolCallId,
        name,
        arguments: args,
        result: blockedResult,
      });
      results.push({ name, result: blockedResult });
      continue;
    }

    const result = await config.tools.execute(name, args);
    callbacks?.onToolResult?.(name, result.content, result.isError ?? false);

    await eventEmitter?.emit(
      createAgentEvent("tool_execution_end", {
        toolCallId,
        name,
        result: result.content,
        isError: result.isError ?? false,
      }),
    );

    await eventEmitter?.emit(
      createAgentEvent("tool_result", {
        name,
        result: result.content,
        isError: result.isError ?? false,
      }),
    );

    await toolHooks?.afterToolCall?.({
      toolCallId,
      name,
      arguments: args,
      result,
    });

    results.push({ name, result: { content: result.content, isError: result.isError } });
  }

  return results;
}

function formatArgsForHistory(args: string): string {
  try {
    const parsed = JSON.parse(args) as Record<string, unknown>;
    return Object.entries(parsed)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(", ");
  } catch {
    return args;
  }
}

function formatToolResult(toolName: string, content: string): string {
  return truncateToolResult(toolName, content);
}
