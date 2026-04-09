import { expect, test } from "vite-plus/test";
import { scriptRunTool } from "../../src/tools/script-run.ts";

test("script_run returns command output", async () => {
  const result = await scriptRunTool.execute({ command: "echo hello" });

  expect(result.isError).toBeFalsy();
  expect(result.content).toContain("hello");
});

test("script_run returns error for empty command", async () => {
  const result = await scriptRunTool.execute({ command: "" });

  expect(result.isError).toBe(true);
  expect(result.content).toContain("required");
});
