import type { ChatOptions, Message, Provider, StreamChunk } from "./types.ts";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

export abstract class BaseProvider implements Provider {
  abstract chat(messages: Message[], options?: ChatOptions): AsyncIterable<StreamChunk>;

  async chatComplete(messages: Message[], options?: ChatOptions): Promise<string> {
    let result = "";
    for await (const chunk of this.chat(messages, options)) {
      if (chunk.type === "text" && chunk.text) {
        result += chunk.text;
      }
    }
    return result;
  }

  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = DEFAULT_MAX_RETRIES,
    baseDelay: number = DEFAULT_BASE_DELAY_MS,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on non-retryable errors
        if (isNonRetryable(lastError)) {
          throw lastError;
        }

        // Last attempt failed
        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await sleep(delay);
      }
    }

    throw lastError ?? new Error("Retry failed");
  }
}

function isNonRetryable(error: Error): boolean {
  const message = error.message.toLowerCase();
  // Don't retry auth errors, validation errors, or bad requests
  return (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("400") ||
    message.includes("invalid") ||
    message.includes("unauthorized")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
