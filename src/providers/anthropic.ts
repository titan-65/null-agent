import { BaseProvider } from "./base.ts";
import type { ChatOptions, Message, ProviderToolDefinition, StreamChunk } from "./types.ts";

export class AnthropicProvider extends BaseProvider {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(options?: { apiKey?: string; baseUrl?: string; model?: string }) {
    super();
    this.apiKey = options?.apiKey ?? process.env["ANTHROPIC_API_KEY"] ?? "";
    this.baseUrl = options?.baseUrl ?? "https://api.anthropic.com/v1/messages";
    this.defaultModel = options?.model ?? "claude-sonnet-4-20250514";
  }

  async *chat(messages: Message[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: options?.model ?? this.defaultModel,
      max_tokens: options?.maxTokens ?? 4096,
      messages: nonSystemMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    };

    if (systemMsg) {
      body["system"] = systemMsg.content;
    }

    if (options?.tools) {
      body["tools"] = this.formatTools(options.tools);
    }

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    // Track current tool call being built
    let currentToolCall: { id: string; name: string; arguments: string } | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);

        try {
          const parsed = JSON.parse(data) as {
            type: string;
            index?: number;
            delta?: {
              type: string;
              text?: string;
              partial_json?: string;
              name?: string;
              id?: string;
            };
            content_block?: {
              type: string;
              name?: string;
              id?: string;
            };
          };

          if (parsed.type === "content_block_start") {
            if (parsed.content_block?.type === "tool_use") {
              currentToolCall = {
                id: parsed.content_block.id ?? "",
                name: parsed.content_block.name ?? "",
                arguments: "",
              };
            }
          }

          if (parsed.type === "content_block_delta") {
            if (parsed.delta?.type === "text_delta" && parsed.delta.text) {
              yield { type: "text", text: parsed.delta.text };
            }
            if (
              parsed.delta?.type === "input_json_delta" &&
              parsed.delta.partial_json &&
              currentToolCall
            ) {
              currentToolCall.arguments += parsed.delta.partial_json;
            }
          }

          if (parsed.type === "content_block_stop" && currentToolCall) {
            yield {
              type: "tool_call",
              toolCall: {
                id: currentToolCall.id,
                name: currentToolCall.name,
                arguments: currentToolCall.arguments || "{}",
              },
            };
            currentToolCall = null;
          }

          if (parsed.type === "message_stop") {
            yield { type: "done" };
            return;
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    yield { type: "done" };
  }

  private formatTools(tools: ProviderToolDefinition[]): Record<string, unknown>[] {
    return tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }
}
