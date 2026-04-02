import type { Message } from "../providers/types.ts";
import type { AgentCallbacks, AgentConfig, AgentResult } from "./types.ts";
import { buildMessages, buildSystemPrompt } from "./context.ts";

export async function runAgent(
  config: AgentConfig,
  userMessage: string,
  history: Message[],
  callbacks?: AgentCallbacks,
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

  while (iterations < maxIterations) {
    iterations++;

    const messages = buildMessages(systemPrompt, currentHistory);
    const providerTools = config.tools.toProviderTools();

    let assistantText = "";
    const pendingToolCalls: Array<{
      id: string;
      name: string;
      arguments: string;
    }> = [];

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
      }

      if (chunk.type === "tool_call" && chunk.toolCall) {
        pendingToolCalls.push(chunk.toolCall);
      }
    }

    // No tool calls — we have a final text response
    if (pendingToolCalls.length === 0) {
      fullResponse = assistantText;
      currentHistory.push({ role: "assistant", content: assistantText });
      break;
    }

    // Aggregate tool calls by ID
    const aggregatedCalls = aggregateToolCalls(pendingToolCalls);

    // Execute tool calls in parallel when possible
    const results = await executeToolCalls(aggregatedCalls, config, callbacks, toolCalls);

    // Build the assistant message with tool calls
    const toolCallDescriptions = aggregatedCalls
      .map((tc) => `Called ${tc.name}(${formatArgsForHistory(tc.arguments)})`)
      .join("\n");

    const assistantMessage = assistantText
      ? `${assistantText}\n${toolCallDescriptions}`
      : toolCallDescriptions;

    currentHistory.push({ role: "assistant", content: assistantMessage });

    // Add tool results as messages
    for (const { name, result } of results) {
      const formattedResult = formatToolResult(name, result.content);
      currentHistory.push({
        role: "user",
        content: `[Tool: ${name}]\n${formattedResult}`,
      });
    }

    // If we've hit max iterations
    if (iterations >= maxIterations) {
      fullResponse = assistantText || "Max iterations reached.";
    }
  }

  return {
    content: fullResponse,
    iterations,
    toolCalls,
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
): Promise<Array<{ name: string; result: { content: string; isError?: boolean } }>> {
  // Parse all arguments first
  const parsed = calls.map((tc) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.arguments) as Record<string, unknown>;
    } catch {
      // Invalid JSON
    }
    return { name: tc.name, args };
  });

  // Notify callbacks about all tool calls starting
  for (const { name, args } of parsed) {
    callbacks?.onToolCall?.(name, args);
    toolCalls.push({ name, arguments: args });
  }

  // Execute all tool calls in parallel
  const results = await Promise.all(
    parsed.map(async ({ name, args }) => {
      const result = await config.tools.execute(name, args);
      callbacks?.onToolResult?.(name, result.content, result.isError ?? false);
      return { name, result };
    }),
  );

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
  // For large file reads, truncate but indicate size
  if (toolName === "file_read" && content.length > 3000) {
    const lines = content.split("\n");
    const preview = lines.slice(0, 50).join("\n");
    return `${preview}\n\n[... ${lines.length - 50} more lines (${content.length} chars total)]`;
  }

  // For shell commands with large output
  if (toolName === "shell" && content.length > 2000) {
    return content.slice(0, 2000) + `\n\n[... output truncated (${content.length} chars total)]`;
  }

  return content;
}
