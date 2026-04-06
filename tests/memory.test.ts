import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../src/memory/store.ts";

let testDir: string;
let store: MemoryStore;

beforeEach(async () => {
  testDir = join(tmpdir(), `null-agent-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
  store = new MemoryStore(testDir);
});

afterEach(async () => {
  try {
    await rm(testDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe("MemoryStore.searchConversations", () => {
  it("returns empty array when no conversations exist", async () => {
    const results = await store.searchConversations({ query: "test" });
    expect(results).toEqual([]);
  });

  it("returns empty array for empty query", async () => {
    const results = await store.searchConversations({ query: "" });
    expect(results).toEqual([]);
  });

  it("returns empty array for single character query", async () => {
    const results = await store.searchConversations({ query: "a" });
    expect(results).toEqual([]);
  });

  it("finds conversations by title", async () => {
    await store.saveConversation({
      id: "conv1",
      title: "Fix the auth module",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      messages: [],
      metadata: {
        projectDir: "/test",
        projectName: "test",
        provider: "openai",
        model: "gpt-4o",
        messageCount: 0,
      },
    });

    const results = await store.searchConversations({ query: "auth" });
    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe("conv1");
  });

  it("finds conversations by message content", async () => {
    await store.saveConversation({
      id: "conv2",
      title: "Chat",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      messages: [
        { role: "user", content: "How do I implement the database connection?" },
        { role: "assistant", content: "You can use pg for PostgreSQL..." },
      ],
      metadata: {
        projectDir: "/test",
        projectName: "test",
        provider: "openai",
        model: "gpt-4o",
        messageCount: 2,
      },
    });

    const results = await store.searchConversations({ query: "database" });
    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe("conv2");
    expect(results[0]!.matches.length).toBeGreaterThan(0);
  });

  it("finds conversations by summary", async () => {
    await store.saveConversation({
      id: "conv3",
      title: "Chat",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      messages: [
        { role: "user", content: "Help me with the deployment pipeline" },
        { role: "assistant", content: "Let's set up a CI/CD pipeline..." },
      ],
      metadata: {
        projectDir: "/test",
        projectName: "test",
        provider: "openai",
        model: "gpt-4o",
        messageCount: 2,
        summary: "deployment, pipeline, ci/cd",
      },
    });

    const results = await store.searchConversations({ query: "deployment" });
    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe("conv3");
  });

  it("respects limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      await store.saveConversation({
        id: `conv${i}`,
        title: "Test conversation about testing",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        messages: [],
        metadata: {
          projectDir: "/test",
          projectName: "test",
          provider: "openai",
          model: "gpt-4o",
          messageCount: 0,
        },
      });
    }

    const results = await store.searchConversations({ query: "test", limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("filters by projectDir", async () => {
    await store.saveConversation({
      id: "conv_proj1",
      title: "Test auth",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      messages: [],
      metadata: {
        projectDir: "/project-a",
        projectName: "project-a",
        provider: "openai",
        model: "gpt-4o",
        messageCount: 0,
      },
    });

    await store.saveConversation({
      id: "conv_proj2",
      title: "Test auth",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      messages: [],
      metadata: {
        projectDir: "/project-b",
        projectName: "project-b",
        provider: "openai",
        model: "gpt-4o",
        messageCount: 0,
      },
    });

    const results = await store.searchConversations({
      query: "auth",
      projectDir: "/project-a",
    });

    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe("conv_proj1");
  });

  it("handles multi-word queries", async () => {
    await store.saveConversation({
      id: "conv_multi",
      title: "Implement user authentication",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      messages: [
        { role: "user", content: "How do I implement user authentication with JWT?" },
      ],
      metadata: {
        projectDir: "/test",
        projectName: "test",
        provider: "openai",
        model: "gpt-4o",
        messageCount: 1,
      },
    });

    const results = await store.searchConversations({ query: "user authentication" });
    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe("conv_multi");
  });
});
