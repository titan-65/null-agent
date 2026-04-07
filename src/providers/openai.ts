import { BaseProvider } from "./base.ts";
import type { ChatOptions, Message, ProviderToolDefinition, StreamChunk } from "./types.ts";

export class OpenAIProvider extends BaseProvider {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(options?: { apiKey?: string; baseUrl?: string; model?: string }) {
    super();
    this.apiKey = options?.apiKey ?? process.env["OPENAI_API_KEY"] ?? "";
    this.baseUrl = options?.baseUrl ?? "https://api.openai.com/v1/chat/completions";
    this.defaultModel = options?.model ?? "gpt-5.4";
  }

  async *chat(messages: Message[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    const body = {
      model: options?.model ?? this.defaultModel,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      tools: options?.tools ? this.formatTools(options.tools) : undefined,
      tool_choice: options?.tool_choice,
      stream: true,
    };

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    // Accumulate tool calls by index
    const toolCallAccum = new Map<number, { id: string; name: string; arguments: string }>();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          // Emit accumulated tool calls
          for (const tc of toolCallAccum.values()) {
            yield {
              type: "tool_call",
              toolCall: {
                id: tc.id,
                name: tc.name,
                arguments: tc.arguments,
              },
            };
          }
          yield { type: "done" };
          return;
        }

        try {
          const parsed = JSON.parse(data) as {
            choices: Array<{
              delta: {
                content?: string;
                tool_calls?: Array<{
                  id?: string;
                  index: number;
                  function?: { name?: string; arguments?: string };
                }>;
              };
              finish_reason?: string;
            }>;
          };

          for (const choice of parsed.choices) {
            if (choice.delta.content) {
              yield { type: "text", text: choice.delta.content };
            }

            if (choice.delta.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                const existing = toolCallAccum.get(tc.index);
                if (existing) {
                  if (tc.id) existing.id = tc.id;
                  if (tc.function?.name) existing.name = tc.function.name;
                  if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                } else {
                  toolCallAccum.set(tc.index, {
                    id: tc.id ?? "",
                    name: tc.function?.name ?? "",
                    arguments: tc.function?.arguments ?? "",
                  });
                }
              }
            }

            if (choice.finish_reason === "stop") {
              // Emit accumulated tool calls
              for (const tc of toolCallAccum.values()) {
                yield {
                  type: "tool_call",
                  toolCall: {
                    id: tc.id,
                    name: tc.name,
                    arguments: tc.arguments,
                  },
                };
              }
              yield { type: "done" };
              return;
            }
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    // Emit any remaining tool calls
    for (const tc of toolCallAccum.values()) {
      yield {
        type: "tool_call",
        toolCall: {
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        },
      };
    }
    yield { type: "done" };
  }

  private formatTools(tools: ProviderToolDefinition[]): Record<string, unknown>[] {
    return tools.map((t) => ({
      type: "function",
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }));
  }
}
