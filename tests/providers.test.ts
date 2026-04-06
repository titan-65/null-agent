import { expect, test, vi, describe } from "vite-plus/test";
import { AnthropicProvider } from "../src/providers/anthropic.ts";
import { OpenAIProvider } from "../src/providers/openai.ts";
import type { StreamChunk } from "../src/providers/types.ts";

describe("AnthropicProvider streaming", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(
        "data: {\"type\":\"message_stop\"}\n\n",
        { status: 200, headers: { "content-type": "text/event-stream" } }
      );
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("streams text chunks", async () => {
    const provider = new AnthropicProvider({ apiKey: "test-key" });
    
    const chunks: StreamChunk[] = [];
    for await (const chunk of provider.chat([{ role: "user", content: "Hi" }])) {
      chunks.push(chunk);
    }
    
    expect(chunks.some(c => c.type === "text")).toBe(true);
    expect(chunks.some(c => c.type === "done")).toBe(true);
  });

  test("uses default model when not specified", async () => {
    const provider = new AnthropicProvider({ apiKey: "test-key" });
    const originalFetch = globalThis.fetch;
    
    let capturedBody: string | null = null;
    globalThis.fetch = vi.fn(async (url, options) => {
      capturedBody = options?.body as string;
      return new Response(
        "data: {\"type\":\"message_stop\"}\n\n",
        { status: 200, headers: { "content-type": "text/event-stream" } }
      );
    });
    
    try {
      for await (const _ of provider.chat([{ role: "user", content: "test" }])) {}
      
      expect(capturedBody).toContain("claude-sonnet");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("uses custom model when specified", async () => {
    const provider = new AnthropicProvider({ apiKey: "test-key", model: "claude-3-opus" });
    const originalFetch = globalThis.fetch;
    
    let capturedBody: string | null = null;
    globalThis.fetch = vi.fn(async (_url, options) => {
      capturedBody = options?.body as string;
      return new Response(
        "data: {\"type\":\"message_stop\"}\n\n",
        { status: 200, headers: { "content-type": "text/event-stream" } }
      );
    });
    
    try {
      for await (const _ of provider.chat([{ role: "user", content: "test" }])) {}
      
      expect(capturedBody).toContain("claude-3-opus");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("passes system message", async () => {
    const provider = new AnthropicProvider({ apiKey: "test-key" });
    const originalFetch = globalThis.fetch;
    
    let capturedBody: string | null = null;
    globalThis.fetch = vi.fn(async (_url, options) => {
      capturedBody = options?.body as string;
      return new Response(
        "data: {\"type\":\"message_stop\"}\n\n",
        { status: 200, headers: { "content-type": "text/event-stream" } }
      );
    });
    
    try {
      for await (const _ of provider.chat([
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hi" }
      ])) {}
      
      expect(capturedBody).toContain('"system":"You are helpful."');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("handles tool use streaming", async () => {
    const provider = new AnthropicProvider({ apiKey: "test-key" });
    const originalFetch = globalThis.fetch;
    
    const toolUseStream = [
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tool1","name":"get_weather"}}',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"location\\":\\"NYC\\"}"}}',
      'data: {"type":"content_block_stop","index":0}',
      'data: {"type":"message_stop"}',
    ].join("\n");
    
    globalThis.fetch = vi.fn(async () => {
      return new Response(toolUseStream, {
        status: 200,
        headers: { "content-type": "text/event-stream" }
      });
    });
    
    try {
      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.chat([{ role: "user", content: "What's the weather?" }])) {
        chunks.push(chunk);
      }
      
      const toolCallChunk = chunks.find(c => c.type === "tool_call");
      expect(toolCallChunk).toBeDefined();
      expect(toolCallChunk?.toolCall?.name).toBe("get_weather");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("throws on API error", async () => {
    const provider = new AnthropicProvider({ apiKey: "test-key" });
    const originalFetch = globalThis.fetch;
    
    globalThis.fetch = vi.fn(async () => {
      return new Response("API Error", { status: 401 });
    });
    
    try {
      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.chat([{ role: "user", content: "Hi" }])) {
        chunks.push(chunk);
      }
      expect(true).toBe(false); // Should have thrown
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("401");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("OpenAIProvider streaming", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(
        "data: [DONE]\n\n",
        { status: 200, headers: { "content-type": "text/event-stream" } }
      );
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("streams text chunks", async () => {
    const provider = new OpenAIProvider({ apiKey: "test-key" });
    
    const chunks: StreamChunk[] = [];
    for await (const chunk of provider.chat([{ role: "user", content: "Hi" }])) {
      chunks.push(chunk);
    }
    
    expect(chunks.some(c => c.type === "text")).toBe(true);
    expect(chunks.some(c => c.type === "done")).toBe(true);
  });

  test("uses default model when not specified", async () => {
    const provider = new OpenAIProvider({ apiKey: "test-key" });
    const originalFetch = globalThis.fetch;
    
    let capturedBody: string | null = null;
    globalThis.fetch = vi.fn(async (_url, options) => {
      capturedBody = options?.body as string;
      return new Response(
        "data: [DONE]\n\n",
        { status: 200, headers: { "content-type": "text/event-stream" } }
      );
    });
    
    try {
      for await (const _ of provider.chat([{ role: "user", content: "test" }])) {}
      
      expect(capturedBody).toContain("gpt-4o");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("uses custom model when specified", async () => {
    const provider = new OpenAIProvider({ apiKey: "test-key", model: "gpt-4-turbo" });
    const originalFetch = globalThis.fetch;
    
    let capturedBody: string | null = null;
    globalThis.fetch = vi.fn(async (_url, options) => {
      capturedBody = options?.body as string;
      return new Response(
        "data: [DONE]\n\n",
        { status: 200, headers: { "content-type": "text/event-stream" } }
      );
    });
    
    try {
      for await (const _ of provider.chat([{ role: "user", content: "test" }])) {}
      
      expect(capturedBody).toContain("gpt-4-turbo");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("handles tool call streaming", async () => {
    const provider = new OpenAIProvider({ apiKey: "test-key" });
    const originalFetch = globalThis.fetch;
    
    const toolCallStream = [
      'data: {"choices":[{"delta":{"tool_calls":[{"id":"tool1","index":0,"function":{"name":"get_weather","arguments":""}}]}}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"location\\":\\"NYC\\"}"}}]}}]}',
      'data: {"choices":[{"finish_reason":"tool_calls","delta":{}}]}',
    ].join("\n");
    
    globalThis.fetch = vi.fn(async () => {
      return new Response(toolCallStream, {
        status: 200,
        headers: { "content-type": "text/event-stream" }
      });
    });
    
    try {
      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.chat([{ role: "user", content: "What's the weather?" }])) {
        chunks.push(chunk);
      }
      
      const toolCallChunk = chunks.find(c => c.type === "tool_call");
      expect(toolCallChunk).toBeDefined();
      expect(toolCallChunk?.toolCall?.name).toBe("get_weather");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("throws on API error", async () => {
    const provider = new OpenAIProvider({ apiKey: "test-key" });
    const originalFetch = globalThis.fetch;
    
    globalThis.fetch = vi.fn(async () => {
      return new Response("API Error", { status: 401 });
    });
    
    try {
      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.chat([{ role: "user", content: "Hi" }])) {
        chunks.push(chunk);
      }
      expect(true).toBe(false); // Should have thrown
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("401");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
