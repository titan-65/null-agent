import type { Provider, ChatOptions, Message, StreamChunk } from "../providers/types.ts";

export interface FauxProviderOptions {
  responses?: string[];
  streamChunks?: string[][];
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  delay?: number;
  error?: string;
}

export class FauxProvider implements Provider {
  private responseIndex = 0;
  private options: Required<FauxProviderOptions>;

  constructor(options: FauxProviderOptions = {}) {
    this.options = {
      responses: options.responses ?? ["Hello!"],
      streamChunks: options.streamChunks ?? [["H", "ello", "!"]],
      toolCalls: options.toolCalls ?? [],
      delay: options.delay ?? 10,
      error: options.error ?? "",
    };
  }

  setResponses(responses: string[]): void {
    this.options = { ...this.options, responses };
    this.responseIndex = 0;
  }

  setStreamChunks(chunks: string[][]): void {
    this.options = { ...this.options, streamChunks: chunks };
    this.responseIndex = 0;
  }

  setToolCalls(toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>): void {
    this.options = { ...this.options, toolCalls };
  }

  setError(error: string): void {
    this.options = { ...this.options, error };
  }

  async *chat(messages: Message[], options?: ChatOptions): AsyncIterable<StreamChunk> {
    if (this.options.error) {
      throw new Error(this.options.error);
    }

    const { streamChunks, toolCalls } = this.options;
    const chunkSet = streamChunks[this.responseIndex] ?? streamChunks[0] ?? [];
    const response = this.options.responses[this.responseIndex] ?? this.options.responses[0] ?? "";

    this.responseIndex = (this.responseIndex + 1) % this.options.responses.length;

    if (options?.tools && toolCalls.length > 0) {
      for (const char of chunkSet) {
        await delay(this.options.delay);
        yield { type: "text", text: char };
      }

      for (const tc of toolCalls) {
        yield {
          type: "tool_call" as const,
          toolCall: {
            id: `tool_${Date.now()}`,
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        };
      }
    } else {
      for (const char of chunkSet) {
        await delay(this.options.delay);
        yield { type: "text", text: char };
      }
    }

    yield { type: "done" };
  }

  async chatComplete(messages: Message[], _options?: ChatOptions): Promise<string> {
    if (this.options.error) {
      throw new Error(this.options.error);
    }

    const response = this.options.responses[this.responseIndex] ?? this.options.responses[0] ?? "";
    this.responseIndex = (this.responseIndex + 1) % this.options.responses.length;

    return response;
  }

  reset(): void {
    this.responseIndex = 0;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createFauxProvider(options?: FauxProviderOptions): FauxProvider {
  return new FauxProvider(options);
}
