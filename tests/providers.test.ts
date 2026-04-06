import { expect, test, vi, describe, beforeEach, afterEach } from "vite-plus/test";
import { AnthropicProvider } from "../src/providers/anthropic.ts";
import { OpenAIProvider } from "../src/providers/openai.ts";
import type { StreamChunk } from "../src/providers/types.ts";

describe("AnthropicProvider streaming", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response('data: {"type":"message_stop"}\n\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("streams text chunks", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\ndata: {"type":"message_stop"}\n\n',
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ),
    );

    const provider = new AnthropicProvider({ apiKey: "test-key" });

    const chunks: StreamChunk[] = [];
    for await (const chunk of provider.chat([{ role: "user", content: "Hi" }])) {
      chunks.push(chunk);
    }

    expect(chunks.some((c) => c.type === "text")).toBe(true);
    expect(chunks.some((c) => c.type === "done")).toBe(true);
  });

  test("uses default model when not specified", async () => {
    const provider = new AnthropicProvider({ apiKey: "test-key" });

    let capturedBody: string | null = null;
    vi.mocked(fetch).mockImplementationOnce(async (_url, options) => {
      capturedBody = options?.body as string;
      return new Response('data: {"type":"message_stop"}\n\n', {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });

    for await (const _ of provider.chat([{ role: "user", content: "test" }])) {
    }

    expect(capturedBody).toContain("claude-sonnet");
  });

  test("uses custom model when specified", async () => {
    const provider = new AnthropicProvider({ apiKey: "test-key", model: "claude-3-opus" });

    let capturedBody: string | null = null;
    vi.mocked(fetch).mockImplementationOnce(async (_url, options) => {
      capturedBody = options?.body as string;
      return new Response('data: {"type":"message_stop"}\n\n', {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });

    for await (const _ of provider.chat([{ role: "user", content: "test" }])) {
    }

    expect(capturedBody).toContain("claude-3-opus");
  });

  test("passes system message", async () => {
    const provider = new AnthropicProvider({ apiKey: "test-key" });

    let capturedBody: string | null = null;
    vi.mocked(fetch).mockImplementationOnce(async (_url, options) => {
      capturedBody = options?.body as string;
      return new Response('data: {"type":"message_stop"}\n\n', {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });

    for await (const _ of provider.chat([
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hi" },
    ])) {
    }

    expect(capturedBody).toContain('"system":"You are helpful."');
  });

  test("handles tool use streaming", async () => {
    const provider = new AnthropicProvider({ apiKey: "test-key" });

    const toolUseStream = [
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tool1","name":"get_weather"}}',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"location\\":\\"NYC\\"}"}}',
      'data: {"type":"content_block_stop","index":0}',
      'data: {"type":"message_stop"}',
    ].join("\n");

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(toolUseStream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const chunks: StreamChunk[] = [];
    for await (const chunk of provider.chat([{ role: "user", content: "What's the weather?" }])) {
      chunks.push(chunk);
    }

    const toolCallChunk = chunks.find((c) => c.type === "tool_call");
    expect(toolCallChunk).toBeDefined();
    expect(toolCallChunk?.toolCall?.name).toBe("get_weather");
  });

  test("throws on API error", async () => {
    const provider = new AnthropicProvider({ apiKey: "test-key" });

    vi.mocked(fetch).mockResolvedValueOnce(new Response("API Error", { status: 401 }));

    const gen = provider.chat([{ role: "user", content: "Hi" }]);
    await expect(gen.next()).rejects.toThrow("401");
  });
});

describe("OpenAIProvider streaming", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response("data: [DONE]\n\n", {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("streams text chunks", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":"stop"}]}\n\n', {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const provider = new OpenAIProvider({ apiKey: "test-key" });

    const chunks: StreamChunk[] = [];
    for await (const chunk of provider.chat([{ role: "user", content: "Hi" }])) {
      chunks.push(chunk);
    }

    expect(chunks.some((c) => c.type === "text")).toBe(true);
    expect(chunks.some((c) => c.type === "done")).toBe(true);
  });

  test("uses default model when not specified", async () => {
    const provider = new OpenAIProvider({ apiKey: "test-key" });

    let capturedBody: string | null = null;
    vi.mocked(fetch).mockImplementationOnce(async (_url, options) => {
      capturedBody = options?.body as string;
      return new Response("data: [DONE]\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });

    for await (const _ of provider.chat([{ role: "user", content: "test" }])) {
    }

    expect(capturedBody).toContain("gpt-4o");
  });

  test("uses custom model when specified", async () => {
    const provider = new OpenAIProvider({ apiKey: "test-key", model: "gpt-4-turbo" });

    let capturedBody: string | null = null;
    vi.mocked(fetch).mockImplementationOnce(async (_url, options) => {
      capturedBody = options?.body as string;
      return new Response("data: [DONE]\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });

    for await (const _ of provider.chat([{ role: "user", content: "test" }])) {
    }

    expect(capturedBody).toContain("gpt-4-turbo");
  });

  test("handles tool call streaming", async () => {
    const provider = new OpenAIProvider({ apiKey: "test-key" });

    const toolCallStream = [
      'data: {"choices":[{"delta":{"tool_calls":[{"id":"tool1","index":0,"function":{"name":"get_weather","arguments":""}}]}}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"location\\":\\"NYC\\"}"}}]}}]}',
      'data: {"choices":[{"finish_reason":"tool_calls","delta":{}}]}',
    ].join("\n");

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(toolCallStream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const chunks: StreamChunk[] = [];
    for await (const chunk of provider.chat([{ role: "user", content: "What's the weather?" }])) {
      chunks.push(chunk);
    }

    const toolCallChunk = chunks.find((c) => c.type === "tool_call");
    expect(toolCallChunk).toBeDefined();
    expect(toolCallChunk?.toolCall?.name).toBe("get_weather");
  });

  test("throws on API error", async () => {
    const provider = new OpenAIProvider({ apiKey: "test-key" });

    vi.mocked(fetch).mockResolvedValueOnce(new Response("API Error", { status: 401 }));

    const gen = provider.chat([{ role: "user", content: "Hi" }]);
    await expect(gen.next()).rejects.toThrow("401");
  });
});
