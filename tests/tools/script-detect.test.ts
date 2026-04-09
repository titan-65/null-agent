import { expect, test, beforeEach } from "vite-plus/test";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scriptDetectTool } from "../../src/tools/script-detect.ts";

const TEST_ROOT = join(tmpdir(), "null-agent-script-detect-tool-test");

beforeEach(async () => {
  await rm(TEST_ROOT, { recursive: true, force: true });
  await mkdir(TEST_ROOT, { recursive: true });
});

test("script_detect returns detected scripts as JSON", async () => {
  const pkg = {
    name: "test-project",
    scripts: {
      dev: "vite dev",
      build: "vite build",
      test: "vitest",
    },
  };
  await writeFile(join(TEST_ROOT, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");

  const result = await scriptDetectTool.execute({ cwd: TEST_ROOT });

  expect(result.isError).toBeFalsy();
  const scripts = JSON.parse(result.content);
  expect(scripts).toContainEqual({
    name: "dev",
    source: "package.json",
    command: "vite dev",
  });
  expect(scripts).toContainEqual({
    name: "build",
    source: "package.json",
    command: "vite build",
  });
  expect(scripts).toContainEqual({
    name: "test",
    source: "package.json",
    command: "vitest",
  });
});

test("script_detect uses process.cwd when cwd is not provided", async () => {
  const pkg = {
    name: "test-project",
    scripts: {
      test: "vitest",
    },
  };
  await writeFile(join(process.cwd(), "package.json"), JSON.stringify(pkg, null, 2), "utf-8");

  const result = await scriptDetectTool.execute({});

  expect(result.isError).toBeFalsy();
  const scripts = JSON.parse(result.content);
  expect(Array.isArray(scripts)).toBe(true);
});
