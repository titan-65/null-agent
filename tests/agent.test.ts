import { expect, test } from "vite-plus/test";
import { Agent } from "../src/agent/index.ts";
import { ToolRegistry } from "../src/tools/registry.ts";
import { fileReadTool } from "../src/tools/file-read.ts";
import type { ChatOptions, Message, Provider, StreamChunk } from "../src/providers/types.ts";

class MockProvider implements Provider {
  private responses: string[] = [];
  private callIndex = 0;

  setResponses(responses: string[]): void {
    this.responses = responses;
    this.callIndex = 0;
  }

  async *chat(_messages: Message[], _options?: ChatOptions): AsyncIterable<StreamChunk> {
    const response = this.responses[this.callIndex] ?? "No more mock responses";
    this.callIndex++;

    for (const char of response) {
      yield { type: "text", text: char };
    }
    yield { type: "done" };
  }

  async chatComplete(_messages: Message[], _options?: ChatOptions): Promise<string> {
    const response = this.responses[this.callIndex] ?? "No more mock responses";
    this.callIndex++;
    return response;
  }
}

test("Agent creates and stores history", () => {
  const provider = new MockProvider();
  const tools = new ToolRegistry();
  const agent = new Agent({ provider, tools });

  expect(agent.getHistory()).toHaveLength(0);
  agent.clearHistory();
  expect(agent.getHistory()).toHaveLength(0);
});

test("Agent chat adds to history", async () => {
  const provider = new MockProvider();
  provider.setResponses(["Hello! How can I help?"]);
  const tools = new ToolRegistry();
  const agent = new Agent({ provider, tools });

  await agent.chat("Hi there");

  const history = agent.getHistory();
  expect(history).toHaveLength(2);
  expect(history[0]?.role).toBe("user");
  expect(history[0]?.content).toBe("Hi there");
  expect(history[1]?.role).toBe("assistant");
  expect(history[1]?.content).toBe("Hello! How can I help?");
});

test("Agent clearHistory resets conversation", async () => {
  const provider = new MockProvider();
  provider.setResponses(["Response 1", "Response 2"]);
  const tools = new ToolRegistry();
  const agent = new Agent({ provider, tools });

  await agent.chat("First message");
  expect(agent.getHistory()).toHaveLength(2);

  agent.clearHistory();
  expect(agent.getHistory()).toHaveLength(0);
});

test("Agent receives text callbacks", async () => {
  const provider = new MockProvider();
  provider.setResponses(["4"]);
  const tools = new ToolRegistry();
  const agent = new Agent({ provider, tools });

  const chunks: string[] = [];
  const result = await agent.chat("What is 2+2?", {
    onText: (text) => chunks.push(text),
  });

  expect(result.content).toBe("4");
  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks.join("")).toBe("4");
});

test("Agent tracks iteration count", async () => {
  const provider = new MockProvider();
  provider.setResponses(["Done"]);
  const tools = new ToolRegistry();
  const agent = new Agent({ provider, tools });

  const result = await agent.chat("test");

  expect(result.iterations).toBe(1);
  expect(result.toolCalls).toHaveLength(0);
});

test("Agent with file_read tool works", async () => {
  const provider = new MockProvider();
  provider.setResponses(["The package name is null-agent"]);
  const tools = new ToolRegistry();
  tools.register(fileReadTool);
  const agent = new Agent({ provider, tools });

  const result = await agent.chat("What is in package.json?");

  expect(result.content).toContain("null-agent");
});
