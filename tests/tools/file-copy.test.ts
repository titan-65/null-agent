import { expect, test, beforeEach, afterEach } from "vite-plus/test";
import { writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileCopyTool } from "../../src/tools/file-copy.ts";

const TEST_ROOT = join(tmpdir(), "null-agent-file-copy-test");

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

test("successful file copy - both files exist after", async () => {
  const sourceFile = join(TEST_ROOT, "source.txt");
  const destFile = join(TEST_ROOT, "dest.txt");
  const content = "hello world";

  await writeFile(sourceFile, content, "utf-8");

  const result = await fileCopyTool.execute({
    source: sourceFile,
    destination: destFile,
    rootBoundary: TEST_ROOT,
  });

  expect(result.isError).toBeFalsy();
  expect(result.content).toContain("Copied");
  expect(result.content).toContain(sourceFile);
  expect(result.content).toContain(destFile);

  const sourceContent = await readFile(sourceFile, "utf-8");
  expect(sourceContent).toBe(content);

  const destContent = await readFile(destFile, "utf-8");
  expect(destContent).toBe(content);
});

test("successful file copy with relative paths", async () => {
  const sourceFile = join(TEST_ROOT, "source.txt");
  const destFile = join(TEST_ROOT, "dest.txt");
  const content = "relative path test";

  await writeFile(sourceFile, content, "utf-8");

  const result = await fileCopyTool.execute({
    source: "source.txt",
    destination: "dest.txt",
    rootBoundary: TEST_ROOT,
  });

  expect(result.isError).toBeFalsy();

  const destContent = await readFile(destFile, "utf-8");
  expect(destContent).toBe(content);
});

test("path traversal rejection - source outside root boundary", async () => {
  const sourceFile = join(TEST_ROOT, "secret.txt");
  await writeFile(sourceFile, "secret content", "utf-8");

  const result = await fileCopyTool.execute({
    source: "/etc/passwd",
    destination: join(TEST_ROOT, "evil.txt"),
    rootBoundary: TEST_ROOT,
  });

  expect(result.isError).toBe(true);
  expect(result.content).toContain("outside root boundary");
});

test("path traversal rejection - destination outside root boundary", async () => {
  const sourceFile = join(TEST_ROOT, "source.txt");
  await writeFile(sourceFile, "content", "utf-8");

  const result = await fileCopyTool.execute({
    source: sourceFile,
    destination: "/tmp/evil.txt",
    rootBoundary: TEST_ROOT,
  });

  expect(result.isError).toBe(true);
  expect(result.content).toContain("outside root boundary");
});

test("creating parent directories", async () => {
  const sourceFile = join(TEST_ROOT, "source.txt");
  const destFile = join(TEST_ROOT, "subdir1", "subdir2", "dest.txt");

  await writeFile(sourceFile, "content", "utf-8");

  const result = await fileCopyTool.execute({
    source: sourceFile,
    destination: destFile,
    rootBoundary: TEST_ROOT,
  });

  expect(result.isError).toBeFalsy();

  const destContent = await readFile(destFile, "utf-8");
  expect(destContent).toBe("content");
});

test("error when source file does not exist", async () => {
  const sourceFile = join(TEST_ROOT, "nonexistent.txt");
  const destFile = join(TEST_ROOT, "dest.txt");

  const result = await fileCopyTool.execute({
    source: sourceFile,
    destination: destFile,
    rootBoundary: TEST_ROOT,
  });

  expect(result.isError).toBe(true);
  expect(result.content).toContain("Error copying file");
});
