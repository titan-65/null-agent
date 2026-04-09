import { expect, test, beforeEach } from "vite-plus/test";
import { processStopTool } from "../../src/tools/process-stop.ts";
import { processStartTool } from "../../src/tools/process-start.ts";
import { resetProcessManager } from "../../src/feet/index.ts";

beforeEach(() => {
  resetProcessManager();
});

test("process_stop stops a running process", async () => {
  const startResult = await processStartTool.execute({ command: "sleep 60" });
  expect(startResult.isError).toBeFalsy();
  const { id } = JSON.parse(startResult.content);

  const stopResult = await processStopTool.execute({ id });
  expect(stopResult.isError).toBeFalsy();
  const stopData = JSON.parse(stopResult.content);
  expect(stopData.success).toBe(true);
  expect(stopData.signal).toBe("SIGTERM");
});

test("process_stop returns error for unknown process ID", async () => {
  const result = await processStopTool.execute({ id: "non-existent-id" });
  expect(result.isError).toBe(true);
  expect(result.content).toContain("Failed to stop process");
});

test("process_stop with force uses SIGKILL", async () => {
  const startResult = await processStartTool.execute({ command: "sleep 60" });
  expect(startResult.isError).toBeFalsy();
  const { id } = JSON.parse(startResult.content);

  const stopResult = await processStopTool.execute({ id, force: true });
  expect(stopResult.isError).toBeFalsy();
  const stopData = JSON.parse(stopResult.content);
  expect(stopData.success).toBe(true);
  expect(stopData.signal).toBe("SIGKILL");
});
