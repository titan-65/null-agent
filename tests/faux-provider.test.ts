import { expect, test } from "vite-plus/test";
import { Agent } from "../src/agent/index.ts";
import { ToolRegistry } from "../src/tools/registry.ts";
import { fileReadTool } from "../src/tools/file-read.ts";
import { createFauxProvider } from "../src/testing/faux-provider.ts";

test("Agent with FauxProvider - basic chat", async () => {
  const provider = createFauxProvider({
    responses: ["Hello, how can I help?"],
    streamChunks: [["Hello", ", how can I help?"]],
  });

  const tools = new ToolRegistry();
  tools.register(fileReadTool);
  const agent = new Agent({ provider, tools });

  const result = await agent.chat("Hi there");

  expect(result.content).toContain("Hello");
  expect(result.iterations).toBe(1);
});

test("Agent with FauxProvider - tool call flow", async () => {
  const provider = createFauxProvider({
    responses: ["I'll read that file for you."],
    streamChunks: [["I'll read that file for you."]],
    toolCalls: [
      {
        name: "file_read",
        arguments: { path: "package.json" },
      },
    ],
  });

  const tools = new ToolRegistry();
  tools.register(fileReadTool);
  // Disable orchestrator to get predictable tool calls
  const agent = new Agent({ provider, tools, enableOrchestrator: false });

  const result = await agent.chat("Read package.json");

  // There should be at least one file_read tool call
  const fileReadCalls = result.toolCalls.filter((tc) => tc.name === "file_read");
  expect(fileReadCalls.length).toBeGreaterThanOrEqual(1);
});

test("Agent with FauxProvider - multiple turns", async () => {
  const provider = createFauxProvider({
    responses: ["Let me check that.", "I found it in package.json."],
    streamChunks: [["Let me check that."], ["I found it in package.json."]],
  });

  const tools = new ToolRegistry();
  tools.register(fileReadTool);
  const agent = new Agent({ provider, tools });

  await agent.chat("What's in package.json?");
  const result = await agent.chat("What else?");

  expect(result.content).toContain("found");
});

test("Agent with FauxProvider - error handling", async () => {
  const provider = createFauxProvider({
    error: "API Error",
  });

  const tools = new ToolRegistry();
  const agent = new Agent({ provider, tools });

  await expect(agent.chat("Hello")).rejects.toThrow("API Error");
});

test("Agent with FauxProvider - event handlers", async () => {
  const provider = createFauxProvider({
    responses: ["Done!"],
    streamChunks: [["Done", "!"]],
  });

  const tools = new ToolRegistry();
  const agent = new Agent({ provider, tools });

  const events: string[] = [];
  agent.setEventHandlers({
    onAgentStart: () => events.push("agent_start"),
    onTurnStart: () => events.push("turn_start"),
    onMessageEnd: () => events.push("message_end"),
    onAgentEnd: () => events.push("agent_end"),
  });

  await agent.chat("Hello");

  expect(events).toContain("agent_start");
  expect(events).toContain("turn_start");
  expect(events).toContain("message_end");
  expect(events).toContain("agent_end");
});

test("Agent with FauxProvider - tool hooks", async () => {
  const provider = createFauxProvider({
    responses: ["Reading file..."],
    streamChunks: [["Reading file..."]],
    toolCalls: [
      {
        name: "file_read",
        arguments: { path: "package.json" },
      },
    ],
  });

  const tools = new ToolRegistry();
  tools.register(fileReadTool);

  const beforeCalls: string[] = [];
  const afterCalls: string[] = [];

  const agent = new Agent({
    provider,
    tools,
    toolHooks: {
      beforeToolCall: async (context) => {
        beforeCalls.push(context.name);
      },
      afterToolCall: async (context) => {
        afterCalls.push(context.name);
      },
    },
  });

  const result = await agent.chat("Read the file");

  expect(beforeCalls).toContain("file_read");
  expect(afterCalls).toContain("file_read");
});

test("Agent steering mechanism", async () => {
  const provider = createFauxProvider({
    responses: ["Got it!"],
    streamChunks: [["Got it!"]],
  });

  const tools = new ToolRegistry();
  const agent = new Agent({ provider, tools });

  agent.steer({ role: "user", content: "Remember: prefer TypeScript" });
  const result = await agent.chat("Hello");

  expect(result.content).toContain("Got it");
});

test("Agent followUp mechanism", async () => {
  const provider = createFauxProvider({
    responses: ["First response", "Second response"],
  });

  const tools = new ToolRegistry();
  const agent = new Agent({ provider, tools, enableOrchestrator: false });

  // Queue followUp BEFORE first chat - it will run after first chat completes
  agent.followUp(async () => {
    await agent.chat("Follow up");
  });

  await agent.chat("First");

  // After first chat returns, the followUp should have run and triggered second chat
  // The second chat should have happened, so history should have more messages
  expect(agent.getHistory().length).toBeGreaterThan(2);
});
