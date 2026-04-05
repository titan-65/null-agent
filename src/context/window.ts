import type { Message } from "../providers/types.ts";

export interface ContextConfig {
  maxTokens: number;
  reserveForResponse: number;
  reserveForSystem: number;
  toolResultMaxChars: number;
  messageMaxChars: number;
}

export interface ContextBudget {
  total: number;
  system: number;
  available: number;
  used: number;
  remaining: number;
}

const DEFAULT_CONFIG: ContextConfig = {
  maxTokens: 128_000, // Conservative default
  reserveForResponse: 8_000,
  reserveForSystem: 4_000,
  toolResultMaxChars: 5_000,
  messageMaxChars: 50_000,
};

export class ContextManager {
  private config: ContextConfig;

  constructor(config?: Partial<ContextConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  budgetForModel(model: string): ContextConfig {
    const budgets: Record<string, Partial<ContextConfig>> = {
      "gpt-4o": { maxTokens: 128_000 },
      "gpt-4.1": { maxTokens: 1_048_576 },
      "gpt-4.1-mini": { maxTokens: 1_048_576 },
      o3: { maxTokens: 200_000 },
      "o3-mini": { maxTokens: 200_000 },
      "o4-mini": { maxTokens: 200_000 },
      "claude-sonnet-4-20250514": { maxTokens: 200_000 },
      "claude-opus-4-20250514": { maxTokens: 200_000 },
      "claude-haiku-35-20241022": { maxTokens: 200_000 },
      "gemini-2.0-flash": { maxTokens: 1_048_576 },
      "gemini-2.5-pro-preview-05-06": { maxTokens: 1_048_576 },
      "gemini-2.5-flash-preview-04-17": { maxTokens: 1_048_576 },
    };

    return { ...this.config, ...budgets[model] };
  }

  prepareMessages(messages: Message[], model: string): Message[] {
    const config = this.budgetForModel(model);
    const budget = this.calculateBudget(messages, config);

    if (budget.remaining > 0) {
      return messages;
    }

    // Need to truncate
    return this.truncateMessages(messages, config);
  }

  private calculateBudget(messages: Message[], config: ContextConfig): ContextBudget {
    const used = messages.reduce((sum, msg) => sum + this.estimateTokens(msg.content), 0);

    const systemTokens = messages
      .filter((m) => m.role === "system")
      .reduce((sum, m) => sum + this.estimateTokens(m.content), 0);

    return {
      total: config.maxTokens,
      system: systemTokens,
      available: config.maxTokens - config.reserveForResponse - config.reserveForSystem,
      used,
      remaining: config.maxTokens - config.reserveForResponse - used,
    };
  }

  private truncateMessages(messages: Message[], config: ContextConfig): Message[] {
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    // Always keep the system message
    const budget = config.maxTokens - config.reserveForResponse - config.reserveForSystem;
    let remaining = budget;

    // Keep system messages
    for (const msg of systemMessages) {
      remaining -= this.estimateTokens(msg.content);
    }

    // Keep most recent non-system messages (last in, first out)
    const kept: Message[] = [];
    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const msg = nonSystemMessages[i]!;
      const tokens = this.estimateTokens(msg.content);

      if (tokens > remaining) {
        // Truncate this message
        if (kept.length === 0) {
          // At least keep a truncated version of the last message
          const truncated = this.truncateContent(msg.content, remaining);
          kept.unshift({ ...msg, content: truncated });
        }
        break;
      }

      kept.unshift(msg);
      remaining -= tokens;
    }

    // Add a truncation notice if we dropped messages
    const dropped = nonSystemMessages.length - kept.length;
    if (dropped > 0) {
      const notice: Message = {
        role: "system",
        content: `[Context: ${dropped} earlier messages truncated to stay within token budget. Focus on recent messages.]`,
      };
      return [...systemMessages, notice, ...kept];
    }

    return [...systemMessages, ...kept];
  }

  private truncateContent(content: string, maxTokens: number): string {
    const maxChars = maxTokens * 3; // Rough approximation
    if (content.length <= maxChars) return content;

    return content.slice(0, maxChars - 50) + "\n\n[... content truncated ...]";
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 chars per token for English
    // More accurate for code: ~3 chars per token
    const hasCode = /[{}[\]()<>]/.test(text);
    return Math.ceil(text.length / (hasCode ? 3 : 4));
  }

  formatBudget(budget: ContextBudget): string {
    const pct = Math.round((budget.used / budget.available) * 100);
    return `Context: ${budget.used.toLocaleString()} / ${budget.available.toLocaleString()} tokens (${pct}%)`;
  }
}

// Truncate tool results to prevent them from consuming too much context
export function truncateToolResult(
  toolName: string,
  content: string,
  maxChars: number = 5000,
): string {
  if (content.length <= maxChars) return content;

  const lines = content.split("\n");

  switch (toolName) {
    case "file_read": {
      const maxLines = Math.floor(maxChars / 100);
      const preview = lines.slice(0, maxLines).join("\n");
      return `${preview}\n\n[... ${lines.length - maxLines} more lines (${content.length} chars) ...]`;
    }
    case "shell": {
      const preview = content.slice(0, maxChars - 100);
      return `${preview}\n\n[... output truncated (${content.length} chars) ...]`;
    }
    case "git_log":
    case "git_diff":
    case "git_status": {
      const preview = lines.slice(0, 50).join("\n");
      return `${preview}\n\n[... ${lines.length - 50} more lines ...]`;
    }
    default: {
      const preview = content.slice(0, maxChars - 50);
      return `${preview}\n\n[... truncated ...]`;
    }
  }
}
