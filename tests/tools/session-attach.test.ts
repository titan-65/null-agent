import { expect, test } from "vite-plus/test";
import { sessionAttachTool } from "../../src/tools/session-attach.ts";
import { globalSessionManager } from "../../src/feet/session-manager.ts";

test("session_attach returns error for non-existent session", async () => {
  const result = await sessionAttachTool.execute({ id: "non-existent-id" });

  expect(result.isError).toBe(true);
  expect(result.content).toContain("not found or inactive");
});

test("session_attach returns session output when session exists", async () => {
  const session = await globalSessionManager.create({ name: "test-session" });

  const result = await sessionAttachTool.execute({ id: session.id });

  expect(result.isError).toBeFalsy();
  const parsed = JSON.parse(result.content);
  expect(parsed.output).toBeDefined();
  expect(parsed.exitCode).toBe(0);
});
