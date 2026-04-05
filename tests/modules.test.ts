import { expect, test } from "vite-plus/test";
import { EventBus } from "../src/bus/index.ts";
import { createTask, extractTasks, markTaskDone, formatTaskList } from "../src/agent/tasks.ts";
import { PermissionManager } from "../src/permission/index.ts";
import { ContextManager, truncateToolResult } from "../src/context/window.ts";
import { createConversation, updateConversation } from "../src/memory/store.ts";

// Event Bus tests
test("EventBus emits and receives events", async () => {
  const bus = new EventBus();
  let received = false;

  bus.on("test", (event) => {
    received = true;
    expect(event.data).toBe("hello");
  });

  await bus.emit("test", "hello");
  expect(received).toBe(true);
});

test("EventBus once fires only once", async () => {
  const bus = new EventBus();
  let count = 0;

  bus.once("test", () => {
    count++;
  });

  await bus.emit("test", null);
  await bus.emit("test", null);
  expect(count).toBe(1);
});

test("EventBus can cancel events", async () => {
  const bus = new EventBus();
  let secondFired = false;

  bus.on("test", (event) => {
    event.cancel();
  });
  bus.on("test", () => {
    secondFired = true;
  });

  const result = await bus.emit("test", null);
  expect(result).toBe(false);
  expect(secondFired).toBe(false);
});

test("EventBus unsubscribe works", async () => {
  const bus = new EventBus();
  let count = 0;

  const unsub = bus.on("test", () => {
    count++;
  });

  await bus.emit("test", null);
  unsub();
  await bus.emit("test", null);

  expect(count).toBe(1);
});

// Task Tracker tests
test("createTask creates a task", () => {
  const task = createTask("Fix the bug", "conversation");
  expect(task.description).toBe("Fix the bug");
  expect(task.status).toBe("open");
  expect(task.source).toBe("conversation");
});

test("markTaskDone marks task complete", () => {
  const task = createTask("Do something");
  const done = markTaskDone(task);
  expect(done.status).toBe("done");
  expect(done.completedAt).toBeDefined();
});

test("extractTasks finds task patterns", () => {
  const text = "I need to fix the auth module. We should update the tests.";
  const tasks = extractTasks(text);
  expect(tasks.length).toBeGreaterThan(0);
});

test("formatTaskList shows open tasks", () => {
  const tasks = [createTask("Task 1"), markTaskDone(createTask("Task 2"))];
  const formatted = formatTaskList(tasks);
  expect(formatted).toContain("Task 1");
  expect(formatted).toContain("Completed");
});

// Permission Manager tests
test("PermissionManager auto mode allows all", async () => {
  const pm = new PermissionManager({
    mode: "auto",
    allowWrite: true,
    allowShell: true,
    allowGit: true,
    denyPatterns: [],
  });
  const result = await pm.check("file_write", { path: "test.txt" });
  expect(result.allowed).toBe(true);
});

test("PermissionManager plan mode denies writes", async () => {
  const pm = new PermissionManager({
    mode: "plan",
    allowWrite: true,
    allowShell: true,
    allowGit: true,
    denyPatterns: [],
  });
  const result = await pm.check("file_write", { path: "test.txt" });
  expect(result.allowed).toBe(false);
});

test("PermissionManager confirm mode requires confirmation for writes", async () => {
  const pm = new PermissionManager({
    mode: "confirm",
    allowWrite: true,
    allowShell: true,
    allowGit: true,
    denyPatterns: [],
  });
  const result = await pm.check("file_write", { path: "test.txt" });
  expect(result.requiresConfirmation).toBe(true);
});

// Context Window tests
test("ContextManager estimates tokens", () => {
  const cm = new ContextManager();
  // This is a private method, but we can test prepareMessages
  const messages: Message[] = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello" },
  ];
  const prepared = cm.prepareMessages(messages, "gpt-4o");
  expect(prepared.length).toBe(2);
});

test("truncateToolResult truncates long output", () => {
  const longContent = Array(200).fill("line of content").join("\n");
  const result = truncateToolResult("file_read", longContent, 1000);
  expect(result.length).toBeLessThan(longContent.length);
  expect(result).toContain("more lines");
});

test("truncateToolResult preserves short output", () => {
  const short = "hello";
  const result = truncateToolResult("shell", short, 1000);
  expect(result).toBe(short);
});

// Memory tests
test("createConversation creates a conversation", () => {
  const conv = createConversation("/project", "my-project", "openai", "gpt-4o");
  expect(conv.metadata.projectDir).toBe("/project");
  expect(conv.metadata.projectName).toBe("my-project");
  expect(conv.messages).toHaveLength(0);
});

test("updateConversation updates messages", () => {
  const conv = createConversation("/project", "my-project", "openai", "gpt-4o");
  const messages: Message[] = [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi!" },
  ];
  const updated = updateConversation(conv, messages);
  expect(updated.messages).toHaveLength(2);
  expect(updated.metadata.messageCount).toBe(2);
});
