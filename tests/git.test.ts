import { expect, test } from "vite-plus/test";
import {
  gitBranchTool,
  gitDiffTool,
  gitLogTool,
  gitStatusTool,
  gitTools,
  gitShowTool,
} from "../src/tools/git.ts";

test("git_tools exports all 7 tools", () => {
  expect(gitTools).toHaveLength(7);
  const names = gitTools.map((t) => t.name);
  expect(names).toContain("git_status");
  expect(names).toContain("git_diff");
  expect(names).toContain("git_log");
  expect(names).toContain("git_branch");
  expect(names).toContain("git_add");
  expect(names).toContain("git_commit");
  expect(names).toContain("git_show");
});

test("git_status executes successfully", async () => {
  const result = await gitStatusTool.execute({});
  expect(result.isError).toBe(false);
});

test("git_log returns commits", async () => {
  const result = await gitLogTool.execute({ count: 1 });
  expect(result.isError).toBe(false);
  expect(result.content.length).toBeGreaterThan(0);
});

test("git_branch lists branches", async () => {
  const result = await gitBranchTool.execute({});
  expect(result.isError).toBe(false);
});

test("git_diff with staged returns output", async () => {
  const result = await gitDiffTool.execute({ staged: true });
  expect(result.isError).toBe(false);
});

test("git_show shows HEAD", async () => {
  const result = await gitShowTool.execute({ ref: "HEAD" });
  expect(result.isError).toBe(false);
});

test("git_add requires path parameter", async () => {
  const { gitAddTool } = await import("../src/tools/git.ts");
  const result = await gitAddTool.execute({});
  expect(result.isError).toBe(true);
  expect(result.content).toContain("path");
});

test("git_commit requires message parameter", async () => {
  const { gitCommitTool } = await import("../src/tools/git.ts");
  const result = await gitCommitTool.execute({});
  expect(result.isError).toBe(true);
  expect(result.content).toContain("message");
});
