import { expect, test } from "vite-plus/test";
import { sessionCreateTool } from "../../src/tools/session-create.ts";

test("session_create creates a new session and returns id and name", async () => {
  const result = await sessionCreateTool.execute({});

  expect(result.isError).toBeFalsy();
  const parsed = JSON.parse(result.content);
  expect(parsed.id).toBeDefined();
  expect(parsed.name).toBeDefined();
});

test("session_create accepts optional name parameter", async () => {
  const result = await sessionCreateTool.execute({ name: "my-session" });

  expect(result.isError).toBeFalsy();
  const parsed = JSON.parse(result.content);
  expect(parsed.name).toBe("my-session");
});

test("session_create accepts optional cwd parameter", async () => {
  const result = await sessionCreateTool.execute({ cwd: "/tmp" });

  expect(result.isError).toBeFalsy();
  const parsed = JSON.parse(result.content);
  expect(parsed.id).toBeDefined();
});
