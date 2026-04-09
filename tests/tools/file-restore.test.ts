import { expect, test, beforeEach, afterEach } from "vite-plus/test";
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileRestoreTool } from "../../src/tools/file-restore.ts";
import { moveToTrash, getTrashEntries } from "../../src/tools/trash.ts";

const TEST_ROOT = join(tmpdir(), "null-agent-file-restore-test");

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

test("list trash entries returns all entries", async () => {
  const file1 = join(TEST_ROOT, "file1.txt");
  const file2 = join(TEST_ROOT, "file2.txt");
  await writeFile(file1, "content1", "utf-8");
  await writeFile(file2, "content2", "utf-8");

  await moveToTrash(file1, TEST_ROOT);
  await moveToTrash(file2, TEST_ROOT);

  const result = await fileRestoreTool.execute({ list: true });

  expect(result.isError).toBeFalsy();
  const entries = JSON.parse(result.content);
  expect(entries).toHaveLength(2);
});

test("list trash entries returns empty array when no entries", async () => {
  const result = await fileRestoreTool.execute({ list: true });

  expect(result.isError).toBeFalsy();
  const entries = JSON.parse(result.content);
  expect(entries).toHaveLength(0);
});

test("restore file from trash returns success message with original path", async () => {
  const testFile = join(TEST_ROOT, "restore-me.txt");
  const fileContent = "restore content";
  await writeFile(testFile, fileContent, "utf-8");

  const entry = await moveToTrash(testFile, TEST_ROOT);
  if (entry.isError) {
    throw new Error("moveToTrash failed: " + entry.content);
  }

  const result = await fileRestoreTool.execute({ trashPath: entry.trashPath });

  expect(result.isError).toBeFalsy();
  expect(result.content).toContain("Restored");
  expect(result.content).toContain(testFile);

  const restoredContent = await readFile(testFile, "utf-8");
  expect(restoredContent).toBe(fileContent);
});

test("restore returns error when trashPath not found", async () => {
  const fakePath = join(TEST_ROOT, "trash", "nonexistent");

  const result = await fileRestoreTool.execute({ trashPath: fakePath });

  expect(result.isError).toBe(true);
  expect(result.content).toContain("Error restoring");
});

test("restore returns error when neither trashPath nor list provided", async () => {
  const result = await fileRestoreTool.execute({});

  expect(result.isError).toBe(true);
  expect(result.content).toContain("'trashPath' or 'list' is required");
});

test("restore removes entry from trash list after restoration", async () => {
  const testFile = join(TEST_ROOT, "restore-list-test.txt");
  const fileContent = "restore list test content";
  await writeFile(testFile, fileContent, "utf-8");

  const entry = await moveToTrash(testFile, TEST_ROOT);
  if (entry.isError) {
    throw new Error("moveToTrash failed: " + entry.content);
  }

  await fileRestoreTool.execute({ trashPath: entry.trashPath });

  const entries = await getTrashEntries();
  expect(entries).toHaveLength(0);
});
