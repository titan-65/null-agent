import { expect, test } from "vite-plus/test";
import { ToolRegistry, builtinTools, createDefaultRegistry } from "../src/tools/index.ts";
import { fileReadTool } from "../src/tools/file-read.ts";
import { shellTool } from "../src/tools/shell.ts";

test("builtinTools includes file_read, file_write, shell", () => {
  const names = builtinTools.map((t) => t.name);
  expect(names).toContain("file_read");
  expect(names).toContain("file_write");
  expect(names).toContain("shell");
});

test("ToolRegistry registers and lists tools", () => {
  const registry = new ToolRegistry();
  registry.register(fileReadTool);
  registry.register(shellTool);
  expect(registry.list()).toHaveLength(2);
  expect(registry.get("file_read")).toBeDefined();
  expect(registry.get("nonexistent")).toBeUndefined();
});

test("createDefaultRegistry has all builtin tools", () => {
  const registry = createDefaultRegistry();
  expect(registry.list().length).toBeGreaterThanOrEqual(10);
});

test("toProviderTools converts to provider format", () => {
  const registry = new ToolRegistry();
  registry.register(fileReadTool);
  const providerTools = registry.toProviderTools();
  expect(providerTools).toHaveLength(1);
  expect(providerTools[0]?.type).toBe("function");
  expect(providerTools[0]?.function.name).toBe("file_read");
});

test("file_read tool executes successfully", async () => {
  const result = await fileReadTool.execute({ path: "package.json" });
  expect(result.isError).toBeUndefined();
  expect(result.content).toContain("null-agent");
});

test("shell tool executes successfully", async () => {
  const result = await shellTool.execute({ command: "echo hello" });
  expect(result.isError).toBeUndefined();
  expect(result.content).toContain("hello");
});

test("tool execution handles missing params", async () => {
  const registry = createDefaultRegistry();
  const result = await registry.execute("file_read", {});
  expect(result.isError).toBe(true);
});

test("tool execution handles unknown tool", async () => {
  const registry = createDefaultRegistry();
  const result = await registry.execute("nonexistent", {});
  expect(result.isError).toBe(true);
  expect(result.content).toContain("Unknown tool");
});
