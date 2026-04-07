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

export type ProviderName = "openai" | "anthropic" | "gemini" | "openrouter";

export interface ProviderInfo {
  name: ProviderName;
  displayName: string;
  envKey: string;
  models: string[];
  defaultModel: string;
  freeModels: string[];
  baseUrl: string;
}

export const PROVIDERS: Record<ProviderName, ProviderInfo> = {
  openai: {
    name: "openai",
    displayName: "OpenAI",
    envKey: "OPENAI_API_KEY",
    models: ["gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-4.1", "gpt-4.1-mini"],
    defaultModel: "gpt-5.4",
    freeModels: [],
    baseUrl: "https://api.openai.com/v1/chat/completions",
  },
  anthropic: {
    name: "anthropic",
    displayName: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    models: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"],
    defaultModel: "claude-sonnet-4-6",
    freeModels: [],
    baseUrl: "https://api.anthropic.com/v1/messages",
  },
  gemini: {
    name: "gemini",
    displayName: "Google Gemini",
    envKey: "GEMINI_API_KEY",
    models: ["gemini-3.1-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"],
    defaultModel: "gemini-3.1-flash",
    freeModels: [],
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  },
  openrouter: {
    name: "openrouter",
    displayName: "OpenRouter",
    envKey: "OPENROUTER_API_KEY",
    models: [
      "anthropic/claude-sonnet-4-6",
      "openai/gpt-5.4",
      "google/gemini-3.1-flash",
      "deepseek/deepseek-v3.2",
    ],
    defaultModel: "anthropic/claude-sonnet-4-6",
    freeModels: [
      "openai/gpt-oss-20b:free",
      "google/gemma-3-27b-it:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ],
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
  },
};

export function createProvider(
  name: ProviderName,
  options?: { apiKey?: string; baseUrl?: string; model?: string },
): Provider {
  const apiKey = options?.apiKey ?? process.env[PROVIDERS[name].envKey] ?? "";

  if (!apiKey) {
    throw new ProviderError(name, PROVIDERS[name].envKey);
  }

  const info = PROVIDERS[name];

  switch (name) {
    case "openai":
      return new OpenAIProvider({
        apiKey,
        baseUrl: options?.baseUrl ?? info.baseUrl,
        model: options?.model ?? info.defaultModel,
      });
    case "anthropic":
      return new AnthropicProvider({
        apiKey,
        baseUrl: options?.baseUrl ?? info.baseUrl,
        model: options?.model ?? info.defaultModel,
      });
    case "gemini":
    case "openrouter":
      // Both use OpenAI-compatible API
      return new OpenAIProvider({
        apiKey,
        baseUrl: options?.baseUrl ?? info.baseUrl,
        model: options?.model ?? info.defaultModel,
      });
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

export class ProviderError extends Error {
  providerName: string;
  envKey: string;

  constructor(providerName: string, envKey: string) {
    super();
    this.providerName = providerName;
    this.envKey = envKey;
    this.message = this.formatMessage();
  }

  private formatMessage(): string {
    const info = PROVIDERS[this.providerName as ProviderName];
    const lines = [
      `No API key found for ${info.displayName}.`,
      ``,
      `Options:`,
      `  1. Set ${this.envKey} environment variable`,
      `  2. Run: export ${this.envKey}='your-key'`,
    ];

    if (info.freeModels.length > 0) {
      lines.push(`  3. Use free models: null-agent --provider ${this.providerName}`);
    }

    lines.push(``);
    lines.push(`Available providers with keys:`);
    for (const [name, p] of Object.entries(PROVIDERS)) {
      const hasKey = !!process.env[p.envKey];
      if (hasKey) {
        lines.push(`  ✓ ${p.displayName} (${name})`);
      }
    }

    return lines.join("\n");
  }
}

export function detectProvider(): ProviderName | null {
  // Check which providers have keys configured
  for (const [name, info] of Object.entries(PROVIDERS)) {
    if (process.env[info.envKey]) {
      return name as ProviderName;
    }
  }
  return null;
}

export function getAvailableProviders(): ProviderName[] {
  const available: ProviderName[] = [];
  for (const [name, info] of Object.entries(PROVIDERS)) {
    if (process.env[info.envKey]) {
      available.push(name as ProviderName);
    }
  }
  return available;
}

export function getFreeProviders(): Array<{
  name: ProviderName;
  models: string[];
}> {
  const free: Array<{ name: ProviderName; models: string[] }> = [];
  for (const [name, info] of Object.entries(PROVIDERS)) {
    if (info.freeModels.length > 0) {
      free.push({
        name: name as ProviderName,
        models: info.freeModels,
      });
    }
  }
  return free;
}
