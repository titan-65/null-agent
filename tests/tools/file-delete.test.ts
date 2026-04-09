import { expect, test, beforeEach, afterEach } from "vite-plus/test";
import { writeFile, mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileDeleteTool } from "../../src/tools/file-delete.ts";
import { getTrashEntries } from "../../src/tools/trash.ts";

const TEST_ROOT = join(tmpdir(), "null-agent-file-delete-test");

let originalTestHome: string;

beforeEach(async () => {
  originalTestHome = process.env.NULL_AGENT_TEST_HOME || "";
  process.env.NULL_AGENT_TEST_HOME = TEST_ROOT;
  await mkdir(TEST_ROOT, { recursive: true });
});

afterEach(async () => {
  process.env.NULL_AGENT_TEST_HOME = originalTestHome;
  try {
    await rm(TEST_ROOT, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

test("file is moved to trash, not permanently deleted", async () => {
  const testFile = join(TEST_ROOT, "delete-me.txt");
  const content = "hello world";
  await writeFile(testFile, content, "utf-8");

  const result = await fileDeleteTool.execute({
    path: testFile,
    rootBoundary: TEST_ROOT,
  });

  expect(result.isError).toBeFalsy();
  expect(result.content).toContain("Deleted");
  expect(result.content).toContain("trash");

  await expect(stat(testFile)).rejects.toThrow();
});

test("trash entry is created with correct metadata", async () => {
  const testFile = join(TEST_ROOT, "entry-test.txt");
  const content = "entry test content";
  await writeFile(testFile, content, "utf-8");

  const result = await fileDeleteTool.execute({
    path: testFile,
    rootBoundary: TEST_ROOT,
  });

  expect(result.isError).toBeFalsy();

  const entries = await getTrashEntries();
  expect(entries).toHaveLength(1);
  expect(entries[0].originalPath).toBe(testFile);
  expect(entries[0].operation).toBe("delete");
  expect(entries[0].id).toBeTruthy();
  expect(entries[0].trashPath).toBeTruthy();
});

test("path traversal rejection - file outside root boundary", async () => {
  const testFile = join(TEST_ROOT, "secret.txt");
  await writeFile(testFile, "secret content", "utf-8");

  const result = await fileDeleteTool.execute({
    path: "/etc/passwd",
    rootBoundary: TEST_ROOT,
  });

  expect(result.isError).toBe(true);
  expect(result.content).toContain("outside root boundary");
});

test("error when file does not exist", async () => {
  const nonExistentFile = join(TEST_ROOT, "does-not-exist.txt");

  const result = await fileDeleteTool.execute({
    path: nonExistentFile,
    rootBoundary: TEST_ROOT,
  });

  expect(result.isError).toBe(true);
  expect(result.content).toContain("Failed to move file to trash");
});

test("successful delete with relative path", async () => {
  const testFile = join(TEST_ROOT, "relative.txt");
  const content = "relative path test";
  await writeFile(testFile, content, "utf-8");

  const result = await fileDeleteTool.execute({
    path: "relative.txt",
    rootBoundary: TEST_ROOT,
  });

  expect(result.isError).toBeFalsy();
  expect(result.content).toContain("Deleted");

  await expect(stat(testFile)).rejects.toThrow();
});
