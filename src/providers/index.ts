export type {
  ChatOptions,
  Message,
  Provider,
  ProviderToolDefinition,
  StreamChunk,
  ToolCall,
  ToolCallRequest,
  ToolResult,
} from "./types.ts";
export { BaseProvider } from "./base.ts";
export { OpenAIProvider } from "./openai.ts";
export { AnthropicProvider } from "./anthropic.ts";

import type { Provider } from "./types.ts";
import { OpenAIProvider } from "./openai.ts";
import { AnthropicProvider } from "./anthropic.ts";

export type ProviderName = "openai" | "anthropic";

export function createProvider(
  name: ProviderName,
  options?: { apiKey?: string; baseUrl?: string; model?: string },
): Provider {
  switch (name) {
    case "openai":
      return new OpenAIProvider(options);
    case "anthropic":
      return new AnthropicProvider(options);
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}
