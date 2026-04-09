import { expect, test } from "vite-plus/test";
import { taskSprintTool } from "../../src/tools/task-sprint.ts";

test("task_sprint returns sprint info with task and timeout", async () => {
  const result = await taskSprintTool.execute({ task: "Test task", timeout: 60 });

  expect(result.isError).toBeFalsy();
  const parsed = JSON.parse(result.content);
  expect(parsed.completed).toBe(false);
  expect(parsed.progress).toContain("Test task");
  expect(parsed.timeout).toBe(60);
  expect(parsed.iterations).toBe(0);
});

test("task_sprint accepts optional goal parameter", async () => {
  const result = await taskSprintTool.execute({
    task: "Test task",
    timeout: 30,
    goal: "Custom goal",
  });

  expect(result.isError).toBeFalsy();
  const parsed = JSON.parse(result.content);
  expect(parsed.goal).toBe("Custom goal");
});
