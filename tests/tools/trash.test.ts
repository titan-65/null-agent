import { expect, test, beforeEach, afterEach } from "vite-plus/test";
import { writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { moveToTrash, getTrashEntries, restore, type TrashEntry } from "../../src/tools/trash.ts";

const TEST_ROOT = join(tmpdir(), "null-agent-trash-test");
const TRASH_DIR = join(TEST_ROOT, "trash");
const UNDO_FILE = join(TEST_ROOT, "undo.json");

let originalHomedir: string;

beforeEach(async () => {
  originalHomedir = process.env.NULL_AGENT_TEST_HOME || "";
  process.env.NULL_AGENT_TEST_HOME = TEST_ROOT;
  await mkdir(TEST_ROOT, { recursive: true });
});

afterEach(async () => {
  process.env.NULL_AGENT_TEST_HOME = originalHomedir;
  try {
    await rm(TEST_ROOT, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

test("moveToTrash creates trash entry and moves file", async () => {
  const testFile = join(TEST_ROOT, "test-file.txt");
  const fileContent = "hello world";
  await writeFile(testFile, fileContent, "utf-8");

  const entry = await moveToTrash(testFile, TEST_ROOT);

  expect(entry.originalPath).toBe(testFile);
  expect(entry.trashPath).toContain(TRASH_DIR);
  expect(entry.operation).toBe("delete");
  expect(entry.id).toBeTruthy();

  const undoContent = await readFile(UNDO_FILE, "utf-8");
  const undoEntries: TrashEntry[] = JSON.parse(undoContent);
  expect(undoEntries).toHaveLength(1);
  expect(undoEntries[0].originalPath).toBe(testFile);

  const fileExists = await readFile(entry.trashPath, "utf-8");
  expect(fileExists).toBe(fileContent);
});

test("moveToTrash throws when path is outside root boundary", async () => {
  const testFile = join(TEST_ROOT, "outside.txt");
  await writeFile(testFile, "content", "utf-8");

  const result = await moveToTrash(testFile, "/tmp/different-root");

  expect(result.isError).toBe(true);
  expect(result.content).toContain("outside root boundary");
});

test("getTrashEntries returns all entries", async () => {
  const file1 = join(TEST_ROOT, "file1.txt");
  const file2 = join(TEST_ROOT, "file2.txt");
  await writeFile(file1, "content1", "utf-8");
  await writeFile(file2, "content2", "utf-8");

  await moveToTrash(file1, TEST_ROOT);
  await moveToTrash(file2, TEST_ROOT);

  const entries = await getTrashEntries();

  expect(entries).toHaveLength(2);
  expect(entries[0]).toHaveProperty("id");
  expect(entries[0]).toHaveProperty("originalPath");
  expect(entries[0]).toHaveProperty("trashPath");
  expect(entries[0]).toHaveProperty("timestamp");
  expect(entries[0]).toHaveProperty("operation");
  expect(entries[1].originalPath).toBe(file2);
});

test("restore returns file to original path and removes from log", async () => {
  const testFile = join(TEST_ROOT, "restore-me.txt");
  const fileContent = "restore content";
  await writeFile(testFile, fileContent, "utf-8");

  const entry = await moveToTrash(testFile, TEST_ROOT);

  const restoredPath = await restore(entry.trashPath);

  expect(restoredPath).toBe(testFile);
  const restoredContent = await readFile(testFile, "utf-8");
  expect(restoredContent).toBe(fileContent);

  const entries = await getTrashEntries();
  expect(entries).toHaveLength(0);
});

test("restore throws when entry not found", async () => {
  const fakePath = join(TRASH_DIR, "nonexistent");

  const result = await restore(fakePath);

  expect(result.isError).toBe(true);
  expect(result.content).toContain("not found");
});
