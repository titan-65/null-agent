import { expect, test, beforeEach } from "vite-plus/test";
import { processListTool } from "../../src/tools/process-list.ts";
import { processStartTool } from "../../src/tools/process-start.ts";
import { resetProcessManager } from "../../src/feet/index.ts";

beforeEach(() => {
  resetProcessManager();
});

test("process_list returns empty list when no processes", async () => {
  const result = await processListTool.execute({});
  expect(result.isError).toBeFalsy();
  const processes = JSON.parse(result.content);
  expect(processes).toEqual([]);
});

test("process_list returns running processes", async () => {
  await processStartTool.execute({ command: "sleep 999" });
  await processStartTool.execute({ command: "sleep 999" });

  const result = await processListTool.execute({});
  expect(result.isError).toBeFalsy();
  const processes = JSON.parse(result.content);
  expect(processes).toHaveLength(2);
  expect(processes[0]).toHaveProperty("id");
  expect(processes[0]).toHaveProperty("name");
  expect(processes[0]).toHaveProperty("command");
  expect(processes[0]).toHaveProperty("pid");
  expect(processes[0]).toHaveProperty("status");
});
