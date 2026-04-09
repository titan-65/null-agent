import { expect, test } from "vite-plus/test";
import { processStartTool } from "../../src/tools/process-start.ts";

test("process_start starts a background process and returns process info", async () => {
  const result = await processStartTool.execute({ command: "echo hello" });

  expect(result.isError).toBeFalsy();
  const parsed = JSON.parse(result.content);
  expect(parsed.id).toBeDefined();
  expect(parsed.pid).toBeGreaterThan(0);
  expect(parsed.name).toBeDefined();
});
