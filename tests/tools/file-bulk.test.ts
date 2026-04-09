import { expect, test, beforeEach, afterEach } from "vite-plus/test";
import { writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileBulkTool } from "../../src/tools/file-bulk.ts";

const TEST_ROOT = join(tmpdir(), "null-agent-file-bulk-test");

beforeEach(async () => {
  await mkdir(TEST_ROOT, { recursive: true });
});

afterEach(async () => {
  try {
    await rm(TEST_ROOT, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

test("executes multiple operations in batch", async () => {
  const file1 = join(TEST_ROOT, "file1.txt");
  const file2 = join(TEST_ROOT, "file2.txt");
  const file3 = join(TEST_ROOT, "file3.txt");
  const file4 = join(TEST_ROOT, "file4.txt");

  await writeFile(file1, "content1", "utf-8");

  const result = await fileBulkTool.execute({
    operations: [
      { type: "copy", source: file1, destination: file2 },
      { type: "copy", source: file1, destination: file3 },
      { type: "copy", source: file1, destination: file4 },
    ],
    rootBoundary: TEST_ROOT,
  });

  expect(result.isError).toBeFalsy();

  const content2 = await readFile(file2, "utf-8");
  expect(content2).toBe("content1");

  const content3 = await readFile(file3, "utf-8");
  expect(content3).toBe("content1");

  const content4 = await readFile(file4, "utf-8");
  expect(content4).toBe("content1");
});

test("partial failures - one fails, others succeed", async () => {
  const file1 = join(TEST_ROOT, "file1.txt");
  const file2 = join(TEST_ROOT, "file2.txt");
  const nonexistent = join(TEST_ROOT, "nonexistent.txt");

  await writeFile(file1, "content1", "utf-8");

  const result = await fileBulkTool.execute({
    operations: [
      { type: "copy", source: file1, destination: file2 },
      { type: "delete", path: nonexistent },
    ],
    rootBoundary: TEST_ROOT,
  });

  expect(result.isError).toBeFalsy();

  const parsed = JSON.parse(result.content);
  expect(parsed).toHaveLength(2);
  expect(parsed[0].success).toBe(true);
  expect(parsed[1].success).toBe(false);
  expect(parsed[1].error).toBeDefined();
});

test("empty operations array", async () => {
  const result = await fileBulkTool.execute({
    operations: [],
    rootBoundary: TEST_ROOT,
  });

  expect(result.isError).toBeFalsy();

  const parsed = JSON.parse(result.content);
  expect(parsed).toHaveLength(0);
});

test("mixed move, copy, and delete operations", async () => {
  const sourceFile = join(TEST_ROOT, "source.txt");
  const destFile = join(TEST_ROOT, "dest.txt");
  const copyDest = join(TEST_ROOT, "copy.txt");

  await writeFile(sourceFile, "original content", "utf-8");

  const result = await fileBulkTool.execute({
    operations: [
      { type: "copy", source: sourceFile, destination: copyDest },
      { type: "move", source: sourceFile, destination: destFile },
    ],
    rootBoundary: TEST_ROOT,
  });

  expect(result.isError).toBeFalsy();

  const parsed = JSON.parse(result.content);
  expect(parsed).toHaveLength(2);
  expect(parsed[0].success).toBe(true);
  expect(parsed[1].success).toBe(true);

  const destContent = await readFile(destFile, "utf-8");
  expect(destContent).toBe("original content");

  const copyContent = await readFile(copyDest, "utf-8");
  expect(copyContent).toBe("original content");
});
